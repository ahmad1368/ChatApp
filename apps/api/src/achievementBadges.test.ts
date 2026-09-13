import test from "node:test";
import assert from "node:assert/strict";
import { AchievementBadgeStore, ACHIEVEMENT_BADGES } from "./achievementBadges";

test("getEarnedBadges() is empty for an author who has earned nothing", () => {
  const store = new AchievementBadgeStore();
  assert.deepEqual(store.getEarnedBadges("alice"), []);
});

test("award() rejects a missing author or unknown badge id", () => {
  const store = new AchievementBadgeStore();
  assert.equal(store.award("", "first-match"), false);
  assert.equal(store.award("alice", "not-a-real-badge"), false);
});

test("award() grants a real badge and getEarnedBadges() includes it with an earnedAt timestamp", () => {
  const store = new AchievementBadgeStore();
  const awarded = store.award("alice", "first-match");
  assert.equal(awarded, true);

  const earned = store.getEarnedBadges("alice");
  assert.equal(earned.length, 1);
  assert.equal(earned[0].id, "first-match");
  assert.equal(earned[0].name, ACHIEVEMENT_BADGES.find((b) => b.id === "first-match")?.name);
  assert.ok(earned[0].earnedAt);
});

test("award() is idempotent: awarding the same badge twice only grants it once", () => {
  const store = new AchievementBadgeStore();
  assert.equal(store.award("alice", "first-match"), true);
  assert.equal(store.award("alice", "first-match"), false);
  assert.equal(store.getEarnedBadges("alice").length, 1);
});

test("an author can earn multiple distinct badges", () => {
  const store = new AchievementBadgeStore();
  store.award("alice", "first-match");
  store.award("alice", "week-streak");
  assert.equal(store.getEarnedBadges("alice").length, 2);
});

test("each author's earned badges are independent", () => {
  const store = new AchievementBadgeStore();
  store.award("alice", "first-match");
  assert.deepEqual(store.getEarnedBadges("bob"), []);
});
