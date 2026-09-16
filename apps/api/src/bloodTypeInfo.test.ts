import { test } from "node:test";
import assert from "node:assert/strict";
import { BloodTypeInfoStore } from "./bloodTypeInfo";

test("get() returns empty fields before any update", () => {
  const store = new BloodTypeInfoStore();
  assert.deepEqual(store.get("alice"), { bloodType: null, hideBloodType: false });
});

test("update() sets bloodType and hideBloodType, then get() returns them", () => {
  const store = new BloodTypeInfoStore();
  const result = store.update("alice", "O+", true);
  assert.deepEqual(result, { success: true, bloodTypeInfo: { bloodType: "O+", hideBloodType: true } });
  assert.deepEqual(store.get("alice"), { bloodType: "O+", hideBloodType: true });
});

test("update() rejects a missing author", () => {
  const store = new BloodTypeInfoStore();
  const result = store.update("", "O+", false);
  assert.equal(result.success, false);
});

test("update() rejects an invalid blood type", () => {
  const store = new BloodTypeInfoStore();
  const result = store.update("alice", "Z+", false);
  assert.equal(result.success, false);
});

test("update() accepts null bloodType to clear it", () => {
  const store = new BloodTypeInfoStore();
  store.update("alice", "AB-", false);
  const result = store.update("alice", null, false);
  assert.deepEqual(result, { success: true, bloodTypeInfo: { bloodType: null, hideBloodType: false } });
});

test("each author's blood type info is independent", () => {
  const store = new BloodTypeInfoStore();
  store.update("alice", "A+", false);
  assert.deepEqual(store.get("bob"), { bloodType: null, hideBloodType: false });
});
