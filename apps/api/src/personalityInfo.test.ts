import { test } from "node:test";
import assert from "node:assert/strict";
import { PersonalityInfoStore } from "./personalityInfo";

test("get() returns empty fields before any update", () => {
  const store = new PersonalityInfoStore();
  assert.deepEqual(store.get("alice"), {
    mbtiType: null,
    enneagramType: null,
    hideMbti: false,
    hideEnneagram: false,
  });
});

test("update() rejects a missing author", () => {
  const store = new PersonalityInfoStore();
  const result = store.update("", "INFP", 4, false, false);
  assert.equal(result.success, false);
});

test("update() rejects an invalid MBTI type", () => {
  const store = new PersonalityInfoStore();
  const result = store.update("alice", "XXXX", 4, false, false);
  assert.equal(result.success, false);
});

test("update() rejects an out-of-range enneagram type", () => {
  const store = new PersonalityInfoStore();
  const result = store.update("alice", "INFP", 10, false, false);
  assert.equal(result.success, false);
});

test("update() accepts null for both fields to clear them", () => {
  const store = new PersonalityInfoStore();
  store.update("alice", "INFP", 4, false, false);
  const result = store.update("alice", null, null, false, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), {
    mbtiType: null,
    enneagramType: null,
    hideMbti: false,
    hideEnneagram: false,
  });
});

test("update() normalizes MBTI type case", () => {
  const store = new PersonalityInfoStore();
  const result = store.update("alice", "infp", 4, false, false);
  assert.equal(result.success, true);
  assert.equal(store.get("alice").mbtiType, "INFP");
});

test("update() accepts valid values and independent hide flags, then get() returns them", () => {
  const store = new PersonalityInfoStore();
  const result = store.update("alice", "ENTJ", 8, true, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), {
    mbtiType: "ENTJ",
    enneagramType: 8,
    hideMbti: true,
    hideEnneagram: false,
  });
});

test("updating again replaces the previous personality info for that author", () => {
  const store = new PersonalityInfoStore();
  store.update("alice", "INFP", 4, false, false);
  store.update("alice", "ESTJ", 1, true, true);
  assert.deepEqual(store.get("alice"), {
    mbtiType: "ESTJ",
    enneagramType: 1,
    hideMbti: true,
    hideEnneagram: true,
  });
});

test("each author's personality info is independent", () => {
  const store = new PersonalityInfoStore();
  store.update("alice", "INFP", 4, false, false);
  assert.deepEqual(store.get("bob"), {
    mbtiType: null,
    enneagramType: null,
    hideMbti: false,
    hideEnneagram: false,
  });
});
