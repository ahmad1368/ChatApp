import { test } from "node:test";
import assert from "node:assert/strict";
import { CacheClearLogStore } from "./cacheClearLog";

test("getLastClearedAt() is null before anything happens", () => {
  const store = new CacheClearLogStore();
  assert.equal(store.getLastClearedAt("alice"), null);
});

test("recordClear() rejects a missing author", () => {
  const store = new CacheClearLogStore();
  const result = store.recordClear("");
  assert.deepEqual(result, { success: false, error: "author is required" });
});

test("recordClear() records the current time and getLastClearedAt() reflects it", () => {
  const store = new CacheClearLogStore();
  const result = store.recordClear("alice");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(store.getLastClearedAt("alice"), result.clearedAt);
  }
});

test("a later recordClear() overwrites the earlier timestamp", () => {
  const store = new CacheClearLogStore();
  store.recordClear("alice");
  const first = store.getLastClearedAt("alice");
  const second = store.recordClear("alice");
  assert.equal(store.getLastClearedAt("alice"), second.success ? second.clearedAt : null);
  assert.notEqual(first, null);
});

test("last-cleared time is independent per author", () => {
  const store = new CacheClearLogStore();
  store.recordClear("alice");
  assert.equal(store.getLastClearedAt("bob"), null);
});
