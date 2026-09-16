import { test } from "node:test";
import assert from "node:assert/strict";
import { computeResponseSpeed, MessageEvent } from "./responseSpeed";

function event(roomId: string, author: string, createdAt: string): MessageEvent {
  return { roomId, author, createdAt };
}

test("reports unknown with no messages at all", () => {
  const result = computeResponseSpeed([], "alice");
  assert.equal(result.label, "unknown");
  assert.equal(result.medianResponseSeconds, null);
});

test("reports unknown when the author never replied to anyone", () => {
  const events = [event("room1", "bob", "2024-01-01T00:00:00Z"), event("room1", "bob", "2024-01-01T00:01:00Z")];
  const result = computeResponseSpeed(events, "alice");
  assert.equal(result.label, "unknown");
});

test("classifies a quick reply as fast", () => {
  const events = [event("room1", "bob", "2024-01-01T00:00:00Z"), event("room1", "alice", "2024-01-01T00:01:00Z")];
  const result = computeResponseSpeed(events, "alice");
  assert.equal(result.label, "fast");
  assert.equal(result.medianResponseSeconds, 60);
});

test("classifies a reply within the hour as moderate", () => {
  const events = [event("room1", "bob", "2024-01-01T00:00:00Z"), event("room1", "alice", "2024-01-01T00:30:00Z")];
  const result = computeResponseSpeed(events, "alice");
  assert.equal(result.label, "moderate");
});

test("classifies a slow reply as slow", () => {
  const events = [event("room1", "bob", "2024-01-01T00:00:00Z"), event("room1", "alice", "2024-01-02T00:00:00Z")];
  const result = computeResponseSpeed(events, "alice");
  assert.equal(result.label, "slow");
});

test("does not count consecutive messages from the author themselves as a response", () => {
  const events = [
    event("room1", "bob", "2024-01-01T00:00:00Z"),
    event("room1", "alice", "2024-01-01T00:01:00Z"),
    event("room1", "alice", "2024-01-01T00:02:00Z"),
  ];
  const result = computeResponseSpeed(events, "alice");
  // Only the bob->alice gap (60s) counts, not the alice->alice one.
  assert.equal(result.medianResponseSeconds, 60);
});

test("aggregates response gaps across multiple rooms", () => {
  const events = [
    event("room1", "bob", "2024-01-01T00:00:00Z"),
    event("room1", "alice", "2024-01-01T00:01:00Z"),
    event("room2", "carol", "2024-01-01T00:00:00Z"),
    event("room2", "alice", "2024-01-01T00:03:00Z"),
  ];
  const result = computeResponseSpeed(events, "alice");
  assert.equal(result.medianResponseSeconds, 120);
});

test("uses the median, not the mean, so one slow outlier doesn't dominate", () => {
  const events = [
    event("room1", "bob", "2024-01-01T00:00:00Z"),
    event("room1", "alice", "2024-01-01T00:01:00Z"),
    event("room2", "bob", "2024-01-01T00:00:00Z"),
    event("room2", "alice", "2024-01-01T00:02:00Z"),
    event("room3", "bob", "2024-01-01T00:00:00Z"),
    event("room3", "alice", "2024-01-02T00:00:00Z"),
  ];
  const result = computeResponseSpeed(events, "alice");
  assert.equal(result.label, "fast");
});
