import { test } from "node:test";
import assert from "node:assert/strict";
import { VanishModeStore } from "./vanishMode";

test("isEnabled() is false before anything happens", () => {
  const store = new VanishModeStore();
  assert.equal(store.isEnabled("alice"), false);
});

test("setEnabled() rejects a missing author", () => {
  const store = new VanishModeStore();
  const result = store.setEnabled("", true);
  assert.deepEqual(result, { success: false, error: "author is required" });
});

test("setEnabled(author, true) turns vanish mode on", () => {
  const store = new VanishModeStore();
  const result = store.setEnabled("alice", true);
  assert.deepEqual(result, { success: true, enabled: true });
  assert.equal(store.isEnabled("alice"), true);
});

test("setEnabled(author, false) turns vanish mode back off", () => {
  const store = new VanishModeStore();
  store.setEnabled("alice", true);
  const result = store.setEnabled("alice", false);
  assert.deepEqual(result, { success: true, enabled: false });
  assert.equal(store.isEnabled("alice"), false);
});

test("setEnabled() with a non-true value turns vanish mode off", () => {
  const store = new VanishModeStore();
  store.setEnabled("alice", true);
  store.setEnabled("alice", "yes");
  assert.equal(store.isEnabled("alice"), false);
});

test("vanish mode is independent per author", () => {
  const store = new VanishModeStore();
  store.setEnabled("alice", true);
  assert.equal(store.isEnabled("bob"), false);
});
