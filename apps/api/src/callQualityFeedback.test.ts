import { test } from "node:test";
import assert from "node:assert/strict";
import { CallQualityFeedbackStore } from "./callQualityFeedback";

test("submit accepts a valid rating with no issues or comment", () => {
  const store = new CallQualityFeedbackStore();
  const result = store.submit("call-1", "alice", 5, undefined, undefined);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.feedback.issues, []);
    assert.equal(result.feedback.comment, undefined);
  }
});

test("submit accepts a valid rating with issues and a comment", () => {
  const store = new CallQualityFeedbackStore();
  const result = store.submit("call-1", "alice", 2, ["audioCutOut", "delay"], "Kept freezing");
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.feedback.issues, ["audioCutOut", "delay"]);
    assert.equal(result.feedback.comment, "Kept freezing");
  }
});

test("submit rejects a missing callId or author", () => {
  const store = new CallQualityFeedbackStore();
  const result = store.submit("", "alice", 5, [], undefined);
  assert.equal(result.success, false);
});

test("submit rejects an out-of-range rating", () => {
  const store = new CallQualityFeedbackStore();
  const result = store.submit("call-1", "alice", 6, [], undefined);
  assert.equal(result.success, false);
});

test("submit rejects a non-integer rating", () => {
  const store = new CallQualityFeedbackStore();
  const result = store.submit("call-1", "alice", 3.5, [], undefined);
  assert.equal(result.success, false);
});

test("submit rejects an invalid issue", () => {
  const store = new CallQualityFeedbackStore();
  const result = store.submit("call-1", "alice", 3, ["somethingInvalid"], undefined);
  assert.equal(result.success, false);
});

test("submit rejects a comment over the length limit", () => {
  const store = new CallQualityFeedbackStore();
  const result = store.submit("call-1", "alice", 3, [], "x".repeat(501));
  assert.equal(result.success, false);
});

test("submit overwrites a previous submission from the same author for the same call", () => {
  const store = new CallQualityFeedbackStore();
  store.submit("call-1", "alice", 2, ["delay"], "bad");
  store.submit("call-1", "alice", 5, [], "actually fine");
  const feedback = store.get("call-1", "alice");
  assert.equal(feedback?.rating, 5);
  assert.equal(feedback?.comment, "actually fine");
});

test("get returns null when no feedback exists", () => {
  const store = new CallQualityFeedbackStore();
  assert.equal(store.get("call-1", "alice"), null);
});

test("feedback is tracked independently per author for the same call", () => {
  const store = new CallQualityFeedbackStore();
  store.submit("call-1", "alice", 5, [], undefined);
  assert.equal(store.get("call-1", "bob"), null);
});

test("listAll returns submissions newest first", () => {
  const store = new CallQualityFeedbackStore();
  store.submit("call-1", "alice", 5, [], undefined);
  store.submit("call-2", "bob", 1, ["connectionDropped"], undefined);
  const all = store.listAll();
  assert.equal(all.length, 2);
  assert.equal(all[0].callId, "call-2");
  assert.equal(all[1].callId, "call-1");
});
