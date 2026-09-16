import { test } from "node:test";
import assert from "node:assert/strict";
import { PerContactRingtoneStore } from "./perContactRingtone";

test("getOverride() defaults to null for an untracked pair", () => {
  const store = new PerContactRingtoneStore();
  assert.equal(store.getOverride("alice", "bob"), null);
});

test("setOverride() sets and persists a ringtone override", () => {
  const store = new PerContactRingtoneStore();
  const result = store.setOverride("alice", "bob", "chime");
  assert.deepEqual(result, { success: true, ringtone: "chime" });
  assert.equal(store.getOverride("alice", "bob"), "chime");
});

test("setOverride() rejects missing viewerAuthor or contactAuthor", () => {
  const store = new PerContactRingtoneStore();
  assert.equal(store.setOverride("", "bob", "chime").success, false);
  assert.equal(store.setOverride("alice", "", "chime").success, false);
});

test("setOverride() rejects an unknown ringtone", () => {
  const store = new PerContactRingtoneStore();
  assert.equal(store.setOverride("alice", "bob", "airhorn").success, false);
});

test("setOverride() with null clears an existing override", () => {
  const store = new PerContactRingtoneStore();
  store.setOverride("alice", "bob", "chime");
  const result = store.setOverride("alice", "bob", null);
  assert.deepEqual(result, { success: true, ringtone: null });
  assert.equal(store.getOverride("alice", "bob"), null);
});

test("setOverride() is one-sided — alice's override for bob doesn't affect bob's override for alice", () => {
  const store = new PerContactRingtoneStore();
  store.setOverride("alice", "bob", "chime");
  assert.equal(store.getOverride("bob", "alice"), null);
});

test("getEffectiveRingtone() falls back to the global default with no override", () => {
  const store = new PerContactRingtoneStore();
  assert.equal(store.getEffectiveRingtone("alice", "bob", "default"), "default");
});

test("getEffectiveRingtone() uses the override once set", () => {
  const store = new PerContactRingtoneStore();
  store.setOverride("alice", "bob", "pop");
  assert.equal(store.getEffectiveRingtone("alice", "bob", "default"), "pop");
});
