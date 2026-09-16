import { test } from "node:test";
import assert from "node:assert/strict";
import { AgeInfoStore } from "./ageInfo";

test("update rejects a missing author", () => {
  const store = new AgeInfoStore();
  const result = store.update("", 25);
  assert.equal(result.success, false);
});

test("update rejects an age below the minimum", () => {
  const store = new AgeInfoStore();
  const result = store.update("alice", 17);
  assert.equal(result.success, false);
});

test("update rejects an age above the maximum", () => {
  const store = new AgeInfoStore();
  const result = store.update("alice", 101);
  assert.equal(result.success, false);
});

test("update rejects a non-integer age", () => {
  const store = new AgeInfoStore();
  const result = store.update("alice", 25.5);
  assert.equal(result.success, false);
});

test("update accepts a valid age", () => {
  const store = new AgeInfoStore();
  const result = store.update("alice", 25);
  assert.deepEqual(result, { success: true, age: 25 });
  assert.equal(store.get("alice"), 25);
});

test("update with null clears the age", () => {
  const store = new AgeInfoStore();
  store.update("alice", 25);
  store.update("alice", null);
  assert.equal(store.get("alice"), null);
});

test("get returns null before any age is set", () => {
  const store = new AgeInfoStore();
  assert.equal(store.get("alice"), null);
});

test("age is tracked independently per author", () => {
  const store = new AgeInfoStore();
  store.update("alice", 25);
  assert.equal(store.get("bob"), null);
});
