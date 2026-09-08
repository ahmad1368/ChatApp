import { test } from "node:test";
import assert from "node:assert/strict";
import { VideoCallEffectsStore } from "./videoCallEffects";

test("get() returns defaults before any update", () => {
  const store = new VideoCallEffectsStore();
  assert.deepEqual(store.get("alice"), { beautyFilter: false, backgroundBlur: false });
});

test("update() rejects a missing author", () => {
  const store = new VideoCallEffectsStore();
  const result = store.update("", true, true);
  assert.deepEqual(result, { success: false, error: "author is required" });
});

test("update() sets both flags and get() returns them", () => {
  const store = new VideoCallEffectsStore();
  const result = store.update("alice", true, true);
  assert.deepEqual(result, { success: true, effects: { beautyFilter: true, backgroundBlur: true } });
  assert.deepEqual(store.get("alice"), { beautyFilter: true, backgroundBlur: true });
});

test("update() accepts setting only one flag on", () => {
  const store = new VideoCallEffectsStore();
  store.update("alice", true, false);
  assert.deepEqual(store.get("alice"), { beautyFilter: true, backgroundBlur: false });
});

test("update() coerces non-boolean truthy/falsy values", () => {
  const store = new VideoCallEffectsStore();
  store.update("alice", "yes", 0);
  assert.deepEqual(store.get("alice"), { beautyFilter: false, backgroundBlur: false });
});

test("updating again replaces the previous preference", () => {
  const store = new VideoCallEffectsStore();
  store.update("alice", true, true);
  store.update("alice", false, false);
  assert.deepEqual(store.get("alice"), { beautyFilter: false, backgroundBlur: false });
});

test("preferences are independent per author", () => {
  const store = new VideoCallEffectsStore();
  store.update("alice", true, true);
  assert.deepEqual(store.get("bob"), { beautyFilter: false, backgroundBlur: false });
});
