import { test } from "node:test";
import assert from "node:assert/strict";
import { HeightInfoStore, MIN_HEIGHT_CM, MAX_HEIGHT_CM } from "./heightInfo";

test("get() returns empty fields before any update", () => {
  const store = new HeightInfoStore();
  assert.deepEqual(store.get("alice"), { heightCm: null, hideHeight: false });
});

test("update() rejects a missing author", () => {
  const store = new HeightInfoStore();
  const result = store.update("", 170, false);
  assert.equal(result.success, false);
});

test("update() rejects a non-integer height", () => {
  const store = new HeightInfoStore();
  const result = store.update("alice", 170.5, false);
  assert.equal(result.success, false);
});

test("update() rejects a height below the minimum", () => {
  const store = new HeightInfoStore();
  const result = store.update("alice", MIN_HEIGHT_CM - 1, false);
  assert.equal(result.success, false);
});

test("update() rejects a height above the maximum", () => {
  const store = new HeightInfoStore();
  const result = store.update("alice", MAX_HEIGHT_CM + 1, false);
  assert.equal(result.success, false);
});

test("update() accepts a null height to clear it", () => {
  const store = new HeightInfoStore();
  store.update("alice", 170, false);
  const result = store.update("alice", null, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { heightCm: null, hideHeight: false });
});

test("update() accepts a valid height and hideHeight, then get() returns it", () => {
  const store = new HeightInfoStore();
  const result = store.update("alice", 170, true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { heightCm: 170, hideHeight: true });
});

test("updating again replaces the previous height info for that author", () => {
  const store = new HeightInfoStore();
  store.update("alice", 170, false);
  store.update("alice", 180, true);
  assert.deepEqual(store.get("alice"), { heightCm: 180, hideHeight: true });
});

test("each author's height info is independent", () => {
  const store = new HeightInfoStore();
  store.update("alice", 170, false);
  assert.deepEqual(store.get("bob"), { heightCm: null, hideHeight: false });
});
