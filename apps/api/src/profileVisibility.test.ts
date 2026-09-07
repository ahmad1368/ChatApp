import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileVisibilityStore } from "./profileVisibility";

test("get() returns defaults (both visible) before any update", () => {
  const store = new ProfileVisibilityStore();
  assert.deepEqual(store.get("alice"), { hideAge: false, hideDistance: false });
});

test("update() rejects a missing author", () => {
  const store = new ProfileVisibilityStore();
  const result = store.update("", true, false);
  assert.equal(result.success, false);
});

test("update() sets both flags, then get() returns them", () => {
  const store = new ProfileVisibilityStore();
  const result = store.update("alice", true, true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { hideAge: true, hideDistance: true });
});

test("update() can set the flags independently", () => {
  const store = new ProfileVisibilityStore();
  store.update("alice", true, false);
  assert.deepEqual(store.get("alice"), { hideAge: true, hideDistance: false });
});

test("updating again replaces the previous visibility for that author", () => {
  const store = new ProfileVisibilityStore();
  store.update("alice", true, true);
  store.update("alice", false, false);
  assert.deepEqual(store.get("alice"), { hideAge: false, hideDistance: false });
});

test("each author's visibility is independent", () => {
  const store = new ProfileVisibilityStore();
  store.update("alice", true, true);
  assert.deepEqual(store.get("bob"), { hideAge: false, hideDistance: false });
});
