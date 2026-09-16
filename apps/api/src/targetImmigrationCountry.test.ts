import { test } from "node:test";
import assert from "node:assert/strict";
import { TargetImmigrationCountryStore } from "./targetImmigrationCountry";

test("update() rejects a missing author", () => {
  const store = new TargetImmigrationCountryStore();
  const result = store.update("", "canada", false);
  assert.equal(result.success, false);
});

test("update() rejects an invalid country", () => {
  const store = new TargetImmigrationCountryStore();
  const result = store.update("alice", "narnia", false);
  assert.equal(result.success, false);
});

test("update() accepts a valid country", () => {
  const store = new TargetImmigrationCountryStore();
  const result = store.update("alice", "canada", false);
  assert.deepEqual(result, { success: true, info: { targetCountry: "canada", hideTargetCountry: false } });
});

test("update() with null clears the target country", () => {
  const store = new TargetImmigrationCountryStore();
  store.update("alice", "canada", false);
  store.update("alice", null, false);
  assert.deepEqual(store.get("alice"), { targetCountry: null, hideTargetCountry: false });
});

test("get() defaults to no target country", () => {
  const store = new TargetImmigrationCountryStore();
  assert.deepEqual(store.get("alice"), { targetCountry: null, hideTargetCountry: false });
});

test("update() accepts hideTargetCountry and get() returns it", () => {
  const store = new TargetImmigrationCountryStore();
  store.update("alice", "canada", true);
  assert.deepEqual(store.get("alice"), { targetCountry: "canada", hideTargetCountry: true });
});

test("each author's target country is independent", () => {
  const store = new TargetImmigrationCountryStore();
  store.update("alice", "canada", false);
  assert.deepEqual(store.get("bob"), { targetCountry: null, hideTargetCountry: false });
});
