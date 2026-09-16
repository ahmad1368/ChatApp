import { test } from "node:test";
import assert from "node:assert/strict";
import { ClearedHistoryStore } from "./clearedHistory";

test("clear() records a clearedAt timestamp for the pair", () => {
  const store = new ClearedHistoryStore();
  const result = store.clear("alice", "bob");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(store.getClearedAt("alice", "bob"), result.clearedAt);
  }
});

test("clear() rejects missing viewerAuthor or chatAuthor", () => {
  const store = new ClearedHistoryStore();
  assert.equal(store.clear("", "bob").success, false);
  assert.equal(store.clear("alice", "").success, false);
});

test("clear() rejects clearing history with yourself", () => {
  const store = new ClearedHistoryStore();
  assert.equal(store.clear("alice", "alice").success, false);
});

test("clear() is one-sided — clearing from alice's side doesn't affect bob's view", () => {
  const store = new ClearedHistoryStore();
  store.clear("alice", "bob");
  assert.notEqual(store.getClearedAt("alice", "bob"), null);
  assert.equal(store.getClearedAt("bob", "alice"), null);
});

test("getClearedAt() is null for an untracked pair", () => {
  const store = new ClearedHistoryStore();
  assert.equal(store.getClearedAt("alice", "bob"), null);
});

test("isHidden() is false when the viewer has never cleared history with that author", () => {
  const store = new ClearedHistoryStore();
  assert.equal(store.isHidden("alice", "bob", new Date().toISOString()), false);
});

test("isHidden() is true for a message at or before the clear point", () => {
  const store = new ClearedHistoryStore();
  const result = store.clear("alice", "bob");
  const clearedAt = result.success ? result.clearedAt : "";
  assert.equal(store.isHidden("alice", "bob", clearedAt), true);
  assert.equal(store.isHidden("alice", "bob", new Date(Date.parse(clearedAt) - 1000).toISOString()), true);
});

test("isHidden() is false for a message sent after the clear point", () => {
  const store = new ClearedHistoryStore();
  store.clear("alice", "bob");
  const later = new Date(Date.now() + 60_000).toISOString();
  assert.equal(store.isHidden("alice", "bob", later), false);
});

test("isHidden() only applies to the author it was cleared for", () => {
  const store = new ClearedHistoryStore();
  const result = store.clear("alice", "bob");
  const clearedAt = result.success ? result.clearedAt : "";
  assert.equal(store.isHidden("alice", "carol", clearedAt), false);
});
