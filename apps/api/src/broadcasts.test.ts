import test from "node:test";
import assert from "node:assert/strict";
import { BroadcastStore } from "./broadcasts";

test("list() is empty before any broadcast is sent", () => {
  const store = new BroadcastStore();
  assert.deepEqual(store.list(), []);
});

test("record() rejects a missing title", () => {
  const store = new BroadcastStore();
  const result = store.record("", "Body text", "admin", 10);
  assert.equal(result.success, false);
});

test("record() rejects a title over the character limit", () => {
  const store = new BroadcastStore();
  const result = store.record("a".repeat(81), "Body text", "admin", 10);
  assert.equal(result.success, false);
});

test("record() rejects a missing body", () => {
  const store = new BroadcastStore();
  const result = store.record("Title", "", "admin", 10);
  assert.equal(result.success, false);
});

test("record() rejects a body over the character limit", () => {
  const store = new BroadcastStore();
  const result = store.record("Title", "a".repeat(501), "admin", 10);
  assert.equal(result.success, false);
});

test("record() rejects a missing sentBy", () => {
  const store = new BroadcastStore();
  const result = store.record("Title", "Body text", "", 10);
  assert.equal(result.success, false);
});

test("record() succeeds and captures the recipient count", () => {
  const store = new BroadcastStore();
  const result = store.record("New feature!", "Check out the new pricing page", "admin-1", 42);
  assert.equal(result.success, true);
  assert.equal(result.success && result.broadcast.recipientCount, 42);
  assert.ok(result.success && result.broadcast.id);
});

test("list() returns every broadcast, most recent first", () => {
  const store = new BroadcastStore();
  store.record("First", "Body", "admin", 1);
  store.record("Second", "Body", "admin", 2);
  assert.deepEqual(
    store.list().map((b) => b.title),
    ["Second", "First"]
  );
});
