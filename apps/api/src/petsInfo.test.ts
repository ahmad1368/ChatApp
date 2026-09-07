import { test } from "node:test";
import assert from "node:assert/strict";
import { PetsInfoStore, PET_CATALOG, MAX_SELECTED_PETS } from "./petsInfo";

test("get() returns empty fields before any update", () => {
  const store = new PetsInfoStore();
  assert.deepEqual(store.get("alice"), { pets: [], hidePets: false });
});

test("update() rejects a missing author", () => {
  const store = new PetsInfoStore();
  const result = store.update("", ["dog"], false);
  assert.equal(result.success, false);
});

test("update() rejects a non-array pets value", () => {
  const store = new PetsInfoStore();
  const result = store.update("alice", "dog", false);
  assert.equal(result.success, false);
});

test("update() rejects more than the max number of pet options", () => {
  const store = new PetsInfoStore();
  const result = store.update("alice", PET_CATALOG.slice(0, MAX_SELECTED_PETS + 1), false);
  assert.equal(result.success, false);
});

test("update() rejects an unknown pet option", () => {
  const store = new PetsInfoStore();
  const result = store.update("alice", ["dragon"], false);
  assert.equal(result.success, false);
});

test("update() rejects duplicate pet options", () => {
  const store = new PetsInfoStore();
  const result = store.update("alice", ["dog", "dog"], false);
  assert.equal(result.success, false);
});

test("update() accepts an empty list", () => {
  const store = new PetsInfoStore();
  const result = store.update("alice", [], false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { pets: [], hidePets: false });
});

test("update() accepts valid pets and hidePets, then get() returns them", () => {
  const store = new PetsInfoStore();
  const result = store.update("alice", ["dog", "cat"], true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { pets: ["dog", "cat"], hidePets: true });
});

test("updating again replaces the previous list for that author", () => {
  const store = new PetsInfoStore();
  store.update("alice", ["dog"], false);
  store.update("alice", ["noPets"], false);
  assert.deepEqual(store.get("alice"), { pets: ["noPets"], hidePets: false });
});

test("each author's pets are independent", () => {
  const store = new PetsInfoStore();
  store.update("alice", ["dog"], false);
  assert.deepEqual(store.get("bob"), { pets: [], hidePets: false });
});
