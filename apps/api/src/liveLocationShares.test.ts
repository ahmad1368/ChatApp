import { test } from "node:test";
import assert from "node:assert/strict";
import { LiveLocationShareStore, MIN_LIVE_SHARE_MINUTES, MAX_LIVE_SHARE_MINUTES } from "./liveLocationShares";

test("start() rejects a missing messageId", () => {
  const store = new LiveLocationShareStore();
  const result = store.start("", "alice", 40.7128, -74.006, 15);
  assert.deepEqual(result, { success: false, error: "messageId is required" });
});

test("start() rejects a missing author", () => {
  const store = new LiveLocationShareStore();
  const result = store.start("m1", "", 40.7128, -74.006, 15);
  assert.deepEqual(result, { success: false, error: "author is required" });
});

test("start() rejects out-of-range coordinates", () => {
  const store = new LiveLocationShareStore();
  const result = store.start("m1", "alice", 999, -74.006, 15);
  assert.equal(result.success, false);
});

test("start() rejects a duration below the minimum", () => {
  const store = new LiveLocationShareStore();
  const result = store.start("m1", "alice", 40.7128, -74.006, 0);
  assert.equal(result.success, false);
});

test("start() rejects a duration above the maximum", () => {
  const store = new LiveLocationShareStore();
  const result = store.start("m1", "alice", 40.7128, -74.006, MAX_LIVE_SHARE_MINUTES + 1);
  assert.equal(result.success, false);
});

test("start() accepts a valid share and returns an expiresAt in the future", () => {
  const store = new LiveLocationShareStore();
  const result = store.start("m1", "alice", 40.7128, -74.006, MIN_LIVE_SHARE_MINUTES);
  assert.equal(result.success, true);
  if (result.success) {
    assert.ok(new Date(result.expiresAt).getTime() > Date.now());
  }
});

test("update() rejects when there's no active share for that message", () => {
  const store = new LiveLocationShareStore();
  const result = store.update("unknown", "alice", 40.7128, -74.006);
  assert.equal(result.success, false);
});

test("update() rejects an author who isn't the original sharer", () => {
  const store = new LiveLocationShareStore();
  store.start("m1", "alice", 40.7128, -74.006, 15);
  const result = store.update("m1", "bob", 40.71, -74.0);
  assert.deepEqual(result, { success: false, error: "Only the original sharer can update this location" });
});

test("update() rejects invalid coordinates", () => {
  const store = new LiveLocationShareStore();
  store.start("m1", "alice", 40.7128, -74.006, 15);
  const result = store.update("m1", "alice", 999, -74.0);
  assert.equal(result.success, false);
});

test("update() moves the share's coordinates and returns them", () => {
  const store = new LiveLocationShareStore();
  store.start("m1", "alice", 40.7128, -74.006, 15);
  const result = store.update("m1", "alice", 40.71, -74.0);
  assert.deepEqual(result, { success: true, latitude: 40.71, longitude: -74.0 });
  assert.deepEqual(store.get("m1"), { author: "alice", latitude: 40.71, longitude: -74.0, expiresAt: store.get("m1")?.expiresAt });
});

test("update() rejects once the share has expired", () => {
  const store = new LiveLocationShareStore();
  store.start("m1", "alice", 40.7128, -74.006, MIN_LIVE_SHARE_MINUTES);
  // Force expiry without waiting a real minute.
  const share = store.get("m1");
  if (share) share.expiresAt = new Date(Date.now() - 1000).toISOString();

  const result = store.update("m1", "alice", 40.71, -74.0);
  assert.deepEqual(result, { success: false, error: "This live location share has ended" });
});

test("isActive() is true right after starting and false once expired", () => {
  const store = new LiveLocationShareStore();
  store.start("m1", "alice", 40.7128, -74.006, MIN_LIVE_SHARE_MINUTES);
  assert.equal(store.isActive("m1"), true);

  const share = store.get("m1");
  if (share) share.expiresAt = new Date(Date.now() - 1000).toISOString();
  assert.equal(store.isActive("m1"), false);
});

test("isActive() is false for an unknown message", () => {
  const store = new LiveLocationShareStore();
  assert.equal(store.isActive("unknown"), false);
});

test("get() returns undefined for an unknown message", () => {
  const store = new LiveLocationShareStore();
  assert.equal(store.get("unknown"), undefined);
});
