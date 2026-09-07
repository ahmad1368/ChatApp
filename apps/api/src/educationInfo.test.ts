import { test } from "node:test";
import assert from "node:assert/strict";
import { EducationInfoStore, MAX_SCHOOL_LENGTH } from "./educationInfo";

test("get() returns empty fields before any update", () => {
  const store = new EducationInfoStore();
  assert.deepEqual(store.get("alice"), { school: "", hideSchool: false });
});

test("update() rejects a missing author", () => {
  const store = new EducationInfoStore();
  const result = store.update("", "State University", false);
  assert.equal(result.success, false);
});

test("update() rejects a school over the character limit", () => {
  const store = new EducationInfoStore();
  const result = store.update("alice", "a".repeat(MAX_SCHOOL_LENGTH + 1), false);
  assert.equal(result.success, false);
});

test("update() rejects a school containing a phone number", () => {
  const store = new EducationInfoStore();
  const result = store.update("alice", "call me at 555-123-4567", false);
  assert.equal(result.success, false);
});

test("update() accepts an empty school", () => {
  const store = new EducationInfoStore();
  const result = store.update("alice", "", false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { school: "", hideSchool: false });
});

test("update() accepts a valid school and hideSchool, then get() returns it", () => {
  const store = new EducationInfoStore();
  const result = store.update("alice", "State University", true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { school: "State University", hideSchool: true });
});

test("updating again replaces the previous education info for that author", () => {
  const store = new EducationInfoStore();
  store.update("alice", "State University", false);
  store.update("alice", "Tech Institute", true);
  assert.deepEqual(store.get("alice"), { school: "Tech Institute", hideSchool: true });
});

test("each author's education info is independent", () => {
  const store = new EducationInfoStore();
  store.update("alice", "State University", false);
  assert.deepEqual(store.get("bob"), { school: "", hideSchool: false });
});
