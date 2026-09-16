import { test } from "node:test";
import assert from "node:assert/strict";
import { WasmFilterUsageStore } from "./wasmFilterUsage";

test("getCount() defaults to 0 for an untracked author", () => {
  const store = new WasmFilterUsageStore();
  assert.equal(store.getCount("alice"), 0);
});

test("record() increments and returns the running count", () => {
  const store = new WasmFilterUsageStore();
  assert.equal(store.record("alice"), 1);
  assert.equal(store.record("alice"), 2);
  assert.equal(store.getCount("alice"), 2);
});

test("record() ignores a missing author", () => {
  const store = new WasmFilterUsageStore();
  assert.equal(store.record(""), 0);
  assert.equal(store.record(undefined), 0);
});

test("each author's count is tracked independently", () => {
  const store = new WasmFilterUsageStore();
  store.record("alice");
  store.record("alice");
  store.record("bob");
  assert.equal(store.getCount("alice"), 2);
  assert.equal(store.getCount("bob"), 1);
});
