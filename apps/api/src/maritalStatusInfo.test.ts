import { test } from "node:test";
import assert from "node:assert/strict";
import { MaritalStatusInfoStore } from "./maritalStatusInfo";

test("get() returns empty fields before any update", () => {
  const store = new MaritalStatusInfoStore();
  assert.deepEqual(store.get("alice"), { maritalStatus: null, hideMaritalStatus: false });
});

test("update() rejects a missing author", () => {
  const store = new MaritalStatusInfoStore();
  const result = store.update("", "divorced", false);
  assert.equal(result.success, false);
});

test("update() rejects an invalid option", () => {
  const store = new MaritalStatusInfoStore();
  const result = store.update("alice", "engaged", false);
  assert.equal(result.success, false);
});

test("update() accepts null to clear the value", () => {
  const store = new MaritalStatusInfoStore();
  store.update("alice", "divorced", false);
  const result = store.update("alice", null, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { maritalStatus: null, hideMaritalStatus: false });
});

test("update() accepts a valid option and hide flag, then get() returns it", () => {
  const store = new MaritalStatusInfoStore();
  const result = store.update("alice", "widowed", true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { maritalStatus: "widowed", hideMaritalStatus: true });
});

test("updating again replaces the previous value for that author", () => {
  const store = new MaritalStatusInfoStore();
  store.update("alice", "single", false);
  store.update("alice", "separated", true);
  assert.deepEqual(store.get("alice"), { maritalStatus: "separated", hideMaritalStatus: true });
});

test("each author's marital status info is independent", () => {
  const store = new MaritalStatusInfoStore();
  store.update("alice", "divorced", false);
  assert.deepEqual(store.get("bob"), { maritalStatus: null, hideMaritalStatus: false });
});
