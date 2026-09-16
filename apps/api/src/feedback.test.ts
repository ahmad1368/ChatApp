import { test } from "node:test";
import assert from "node:assert/strict";
import { FeedbackStore } from "./feedback";

test("submit() accepts valid feedback", () => {
  const store = new FeedbackStore();
  const result = store.submit("alice", "bug", "The swipe button is unresponsive on mobile.");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.feedback.author, "alice");
    assert.equal(result.feedback.category, "bug");
    assert.equal(result.feedback.message, "The swipe button is unresponsive on mobile.");
    assert.ok(result.feedback.id);
    assert.ok(result.feedback.createdAt);
  }
});

test("submit() rejects a missing author", () => {
  const store = new FeedbackStore();
  const result = store.submit("", "general", "Great app!");
  assert.equal(result.success, false);
});

test("submit() rejects an invalid category", () => {
  const store = new FeedbackStore();
  const result = store.submit("alice", "complaint", "This is bad");
  assert.equal(result.success, false);
});

test("submit() rejects an empty or whitespace-only message", () => {
  const store = new FeedbackStore();
  assert.equal(store.submit("alice", "general", "").success, false);
  assert.equal(store.submit("alice", "general", "   ").success, false);
});

test("submit() rejects a message over the length limit", () => {
  const store = new FeedbackStore();
  const result = store.submit("alice", "general", "a".repeat(2001));
  assert.equal(result.success, false);
});

test("submit() trims the message", () => {
  const store = new FeedbackStore();
  const result = store.submit("alice", "general", "  hello  ");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.feedback.message, "hello");
  }
});

test("listAll() returns newest first", () => {
  const store = new FeedbackStore();
  store.submit("alice", "bug", "first");
  store.submit("bob", "general", "second");
  const all = store.listAll();
  assert.deepEqual(
    all.map((f) => f.message),
    ["second", "first"]
  );
});

test("count() reflects the number of submissions", () => {
  const store = new FeedbackStore();
  assert.equal(store.count(), 0);
  store.submit("alice", "featureRequest", "Add dark mode");
  assert.equal(store.count(), 1);
});
