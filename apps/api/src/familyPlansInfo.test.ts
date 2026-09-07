import { test } from "node:test";
import assert from "node:assert/strict";
import { FamilyPlansInfoStore } from "./familyPlansInfo";

test("get() returns empty fields before any update", () => {
  const store = new FamilyPlansInfoStore();
  assert.deepEqual(store.get("alice"), { familyPlans: null, hideFamilyPlans: false });
});

test("update() rejects a missing author", () => {
  const store = new FamilyPlansInfoStore();
  const result = store.update("", "wantChildren", false);
  assert.equal(result.success, false);
});

test("update() rejects an invalid option", () => {
  const store = new FamilyPlansInfoStore();
  const result = store.update("alice", "maybe", false);
  assert.equal(result.success, false);
});

test("update() accepts null to clear the value", () => {
  const store = new FamilyPlansInfoStore();
  store.update("alice", "wantChildren", false);
  const result = store.update("alice", null, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { familyPlans: null, hideFamilyPlans: false });
});

test("update() accepts a valid option and hide flag, then get() returns it", () => {
  const store = new FamilyPlansInfoStore();
  const result = store.update("alice", "openToChildren", true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { familyPlans: "openToChildren", hideFamilyPlans: true });
});

test("updating again replaces the previous value for that author", () => {
  const store = new FamilyPlansInfoStore();
  store.update("alice", "dontWantChildren", false);
  store.update("alice", "notSureYet", true);
  assert.deepEqual(store.get("alice"), { familyPlans: "notSureYet", hideFamilyPlans: true });
});

test("each author's family plans info is independent", () => {
  const store = new FamilyPlansInfoStore();
  store.update("alice", "wantChildren", false);
  assert.deepEqual(store.get("bob"), { familyPlans: null, hideFamilyPlans: false });
});
