import { test } from "node:test";
import assert from "node:assert/strict";
import { LifestyleInfoStore } from "./lifestyleInfo";

test("get() returns empty fields before any update", () => {
  const store = new LifestyleInfoStore();
  assert.deepEqual(store.get("alice"), { smoking: null, drinking: null, hideSmoking: false, hideDrinking: false });
});

test("update() rejects a missing author", () => {
  const store = new LifestyleInfoStore();
  const result = store.update("", "no", "no", false, false);
  assert.equal(result.success, false);
});

test("update() rejects an invalid smoking option", () => {
  const store = new LifestyleInfoStore();
  const result = store.update("alice", "occasionally", "no", false, false);
  assert.equal(result.success, false);
});

test("update() rejects an invalid drinking option", () => {
  const store = new LifestyleInfoStore();
  const result = store.update("alice", "no", "heavily", false, false);
  assert.equal(result.success, false);
});

test("update() accepts null for both fields to clear them", () => {
  const store = new LifestyleInfoStore();
  store.update("alice", "yes", "yes", false, false);
  const result = store.update("alice", null, null, false, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { smoking: null, drinking: null, hideSmoking: false, hideDrinking: false });
});

test("update() accepts valid options and hide flags, then get() returns them", () => {
  const store = new LifestyleInfoStore();
  const result = store.update("alice", "sometimes", "onSpecialOccasions", true, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), {
    smoking: "sometimes",
    drinking: "onSpecialOccasions",
    hideSmoking: true,
    hideDrinking: false,
  });
});

test("updating again replaces the previous lifestyle info for that author", () => {
  const store = new LifestyleInfoStore();
  store.update("alice", "no", "no", false, false);
  store.update("alice", "yes", "yes", true, true);
  assert.deepEqual(store.get("alice"), { smoking: "yes", drinking: "yes", hideSmoking: true, hideDrinking: true });
});

test("each author's lifestyle info is independent", () => {
  const store = new LifestyleInfoStore();
  store.update("alice", "yes", "yes", false, false);
  assert.deepEqual(store.get("bob"), { smoking: null, drinking: null, hideSmoking: false, hideDrinking: false });
});
