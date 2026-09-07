import { test } from "node:test";
import assert from "node:assert/strict";
import { StylizedAvatarStore } from "./stylizedAvatar";

test("get() returns empty fields before any update", () => {
  const store = new StylizedAvatarStore();
  assert.deepEqual(store.get("alice"), { style: null, active: false });
});

test("update() rejects a missing author", () => {
  const store = new StylizedAvatarStore();
  const result = store.update("", "cartoonA", true);
  assert.equal(result.success, false);
});

test("update() rejects an invalid style", () => {
  const store = new StylizedAvatarStore();
  const result = store.update("alice", "pixelArt", true);
  assert.equal(result.success, false);
});

test("update() rejects activating with no style chosen", () => {
  const store = new StylizedAvatarStore();
  const result = store.update("alice", null, true);
  assert.equal(result.success, false);
});

test("update() accepts choosing a style without activating it", () => {
  const store = new StylizedAvatarStore();
  const result = store.update("alice", "cartoonA", false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { style: "cartoonA", active: false });
});

test("update() accepts choosing and activating a style, then get() returns it", () => {
  const store = new StylizedAvatarStore();
  const result = store.update("alice", "threeDB", true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { style: "threeDB", active: true });
});

test("update() accepts clearing the style", () => {
  const store = new StylizedAvatarStore();
  store.update("alice", "cartoonA", true);
  const result = store.update("alice", null, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { style: null, active: false });
});

test("updating again replaces the previous selection for that author", () => {
  const store = new StylizedAvatarStore();
  store.update("alice", "cartoonA", true);
  store.update("alice", "threeDA", true);
  assert.deepEqual(store.get("alice"), { style: "threeDA", active: true });
});

test("each author's stylized avatar selection is independent", () => {
  const store = new StylizedAvatarStore();
  store.update("alice", "cartoonA", true);
  assert.deepEqual(store.get("bob"), { style: null, active: false });
});
