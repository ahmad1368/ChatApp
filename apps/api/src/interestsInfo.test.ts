import { test } from "node:test";
import assert from "node:assert/strict";
import { InterestsInfoStore, INTEREST_CATALOG, MAX_SELECTED_INTERESTS } from "./interestsInfo";

test("get() returns empty fields before any update", () => {
  const store = new InterestsInfoStore();
  assert.deepEqual(store.get("alice"), { interests: [], hideInterests: false });
});

test("update() rejects a missing author", () => {
  const store = new InterestsInfoStore();
  const result = store.update("", ["hiking"], false);
  assert.equal(result.success, false);
});

test("update() rejects a non-array interests value", () => {
  const store = new InterestsInfoStore();
  const result = store.update("alice", "hiking", false);
  assert.equal(result.success, false);
});

test("update() rejects more than the max number of interests", () => {
  const store = new InterestsInfoStore();
  const result = store.update("alice", INTEREST_CATALOG.slice(0, MAX_SELECTED_INTERESTS + 1), false);
  assert.equal(result.success, false);
});

test("update() rejects an unknown interest", () => {
  const store = new InterestsInfoStore();
  const result = store.update("alice", ["timetravel"], false);
  assert.equal(result.success, false);
});

test("update() rejects duplicate interests", () => {
  const store = new InterestsInfoStore();
  const result = store.update("alice", ["hiking", "hiking"], false);
  assert.equal(result.success, false);
});

test("update() accepts an empty list", () => {
  const store = new InterestsInfoStore();
  const result = store.update("alice", [], false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { interests: [], hideInterests: false });
});

test("update() accepts valid interests and hideInterests, then get() returns them", () => {
  const store = new InterestsInfoStore();
  const result = store.update("alice", ["hiking", "yoga"], true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { interests: ["hiking", "yoga"], hideInterests: true });
});

test("updating again replaces the previous list for that author", () => {
  const store = new InterestsInfoStore();
  store.update("alice", ["hiking"], false);
  store.update("alice", ["gaming", "reading"], false);
  assert.deepEqual(store.get("alice"), { interests: ["gaming", "reading"], hideInterests: false });
});

test("each author's interests are independent", () => {
  const store = new InterestsInfoStore();
  store.update("alice", ["hiking"], false);
  assert.deepEqual(store.get("bob"), { interests: [], hideInterests: false });
});
