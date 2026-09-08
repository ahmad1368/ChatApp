import { test } from "node:test";
import assert from "node:assert/strict";
import { GenderInfoStore } from "./genderInfo";

test("get() returns undefined before any update", () => {
  const store = new GenderInfoStore();
  assert.equal(store.get("alice"), undefined);
});

test("set() rejects a missing author", () => {
  const store = new GenderInfoStore();
  const result = store.set("", "woman");
  assert.deepEqual(result, { success: false, error: "author is required" });
});

test("set() rejects an invalid gender", () => {
  const store = new GenderInfoStore();
  const result = store.set("alice", "robot");
  assert.equal(result.success, false);
});

test("set() accepts a valid gender, then get() returns it", () => {
  const store = new GenderInfoStore();
  const result = store.set("alice", "woman");
  assert.deepEqual(result, { success: true, gender: "woman" });
  assert.equal(store.get("alice"), "woman");
});

test("updating again replaces the previous value", () => {
  const store = new GenderInfoStore();
  store.set("alice", "woman");
  store.set("alice", "nonBinary");
  assert.equal(store.get("alice"), "nonBinary");
});

test("gender is independent per author", () => {
  const store = new GenderInfoStore();
  store.set("alice", "woman");
  assert.equal(store.get("bob"), undefined);
});
