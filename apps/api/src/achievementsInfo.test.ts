import { test } from "node:test";
import assert from "node:assert/strict";
import { AchievementsInfoStore, MAX_ACHIEVEMENTS, MAX_TITLE_LENGTH } from "./achievementsInfo";

test("get() returns empty fields before any update", () => {
  const store = new AchievementsInfoStore();
  assert.deepEqual(store.get("alice"), { achievements: [], hideAchievements: false });
});

test("update() rejects a missing author", () => {
  const store = new AchievementsInfoStore();
  const result = store.update("", [{ title: "MBA", issuer: "State University", year: 2020 }], false);
  assert.equal(result.success, false);
});

test("update() rejects a non-array achievements value", () => {
  const store = new AchievementsInfoStore();
  const result = store.update("alice", "MBA", false);
  assert.equal(result.success, false);
});

test("update() rejects more than the max number of achievements", () => {
  const store = new AchievementsInfoStore();
  const achievements = Array.from({ length: MAX_ACHIEVEMENTS + 1 }, (_, i) => ({ title: `Award ${i}`, issuer: "", year: null }));
  const result = store.update("alice", achievements, false);
  assert.equal(result.success, false);
});

test("update() rejects an achievement with an empty title", () => {
  const store = new AchievementsInfoStore();
  const result = store.update("alice", [{ title: "", issuer: "State University", year: 2020 }], false);
  assert.equal(result.success, false);
});

test("update() rejects a title over the character limit", () => {
  const store = new AchievementsInfoStore();
  const result = store.update("alice", [{ title: "a".repeat(MAX_TITLE_LENGTH + 1), issuer: "", year: null }], false);
  assert.equal(result.success, false);
});

test("update() rejects a title containing a phone number", () => {
  const store = new AchievementsInfoStore();
  const result = store.update("alice", [{ title: "call me at 555-123-4567", issuer: "", year: null }], false);
  assert.equal(result.success, false);
});

test("update() rejects an out-of-range year", () => {
  const store = new AchievementsInfoStore();
  const result = store.update("alice", [{ title: "MBA", issuer: "State University", year: 1800 }], false);
  assert.equal(result.success, false);
});

test("update() accepts an empty list", () => {
  const store = new AchievementsInfoStore();
  const result = store.update("alice", [], false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { achievements: [], hideAchievements: false });
});

test("update() accepts valid achievements and hideAchievements, then get() returns them", () => {
  const store = new AchievementsInfoStore();
  const result = store.update(
    "alice",
    [{ title: "MBA", issuer: "State University", year: 2020 }],
    true
  );
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), {
    achievements: [{ title: "MBA", issuer: "State University", year: 2020 }],
    hideAchievements: true,
  });
});

test("update() accepts an achievement with no issuer or year", () => {
  const store = new AchievementsInfoStore();
  const result = store.update("alice", [{ title: "Marathon finisher" }], false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), {
    achievements: [{ title: "Marathon finisher", issuer: "", year: null }],
    hideAchievements: false,
  });
});

test("updating again replaces the previous achievements for that author", () => {
  const store = new AchievementsInfoStore();
  store.update("alice", [{ title: "First", issuer: "", year: null }], false);
  store.update("alice", [{ title: "Second", issuer: "", year: null }], false);
  assert.deepEqual(store.get("alice").achievements, [{ title: "Second", issuer: "", year: null }]);
});

test("each author's achievements are independent", () => {
  const store = new AchievementsInfoStore();
  store.update("alice", [{ title: "MBA", issuer: "", year: null }], false);
  assert.deepEqual(store.get("bob"), { achievements: [], hideAchievements: false });
});
