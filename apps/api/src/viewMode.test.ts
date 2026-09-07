import { test } from "node:test";
import assert from "node:assert/strict";
import { ViewModeStore } from "./viewMode";

test("get() defaults to card before anything is set", () => {
  const store = new ViewModeStore();
  assert.equal(store.get("alice"), "card");
});

test("set() rejects a missing author", () => {
  const store = new ViewModeStore();
  assert.deepEqual(store.set("", "grid"), { success: false, error: "author is required" });
});

test("set() rejects an invalid mode", () => {
  const store = new ViewModeStore();
  const result = store.set("alice", "carousel");
  assert.deepEqual(result, { success: false, error: "mode must be one of: card, grid, list" });
});

test("set() then get() persists the chosen mode", () => {
  const store = new ViewModeStore();
  assert.deepEqual(store.set("alice", "grid"), { success: true, mode: "grid" });
  assert.equal(store.get("alice"), "grid");
});

test("view mode is independent per author", () => {
  const store = new ViewModeStore();
  store.set("alice", "list");
  assert.equal(store.get("bob"), "card");
});
