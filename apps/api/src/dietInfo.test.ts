import { test } from "node:test";
import assert from "node:assert/strict";
import { DietInfoStore } from "./dietInfo";

test("get() returns empty fields before any update", () => {
  const store = new DietInfoStore();
  assert.deepEqual(store.get("alice"), { diet: null, hideDiet: false });
});

test("update() sets diet and hideDiet, then get() returns them", () => {
  const store = new DietInfoStore();
  const result = store.update("alice", "vegan", true);
  assert.deepEqual(result, { success: true, dietInfo: { diet: "vegan", hideDiet: true } });
  assert.deepEqual(store.get("alice"), { diet: "vegan", hideDiet: true });
});

test("update() rejects a missing author", () => {
  const store = new DietInfoStore();
  const result = store.update("", "vegan", false);
  assert.equal(result.success, false);
});

test("update() rejects an invalid diet option", () => {
  const store = new DietInfoStore();
  const result = store.update("alice", "carnivore", false);
  assert.equal(result.success, false);
});

test("update() accepts null diet to clear it", () => {
  const store = new DietInfoStore();
  store.update("alice", "vegetarian", false);
  const result = store.update("alice", null, false);
  assert.deepEqual(result, { success: true, dietInfo: { diet: null, hideDiet: false } });
});

test("each author's diet info is independent", () => {
  const store = new DietInfoStore();
  store.update("alice", "vegan", false);
  assert.deepEqual(store.get("bob"), { diet: null, hideDiet: false });
});
