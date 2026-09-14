import test from "node:test";
import assert from "node:assert/strict";
import { WeeklyLeaderboardStore } from "./weeklyLeaderboard";

test("getLeaderboard() is empty when nobody has any activity", () => {
  const store = new WeeklyLeaderboardStore();
  assert.deepEqual(store.getLeaderboard().entries, []);
});

test("recordActivity() and recordPopularity() accumulate per author", () => {
  const store = new WeeklyLeaderboardStore();
  const now = Date.now();
  store.recordActivity("alice", now);
  store.recordActivity("alice", now);
  store.recordPopularity("alice", now);

  const { entries } = store.getLeaderboard(10, now);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].activityCount, 2);
  assert.equal(entries[0].popularityCount, 1);
});

test("getLeaderboard() ranks by total score, weighting popularity above raw activity", () => {
  const store = new WeeklyLeaderboardStore();
  const now = Date.now();
  for (let i = 0; i < 5; i++) store.recordActivity("alice", now); // 5 activity
  store.recordPopularity("bob", now);
  store.recordPopularity("bob", now);
  store.recordPopularity("bob", now); // 3 popularity = 6 score, beats alice's 5

  const { entries } = store.getLeaderboard(10, now);
  assert.equal(entries[0].author, "bob");
  assert.equal(entries[1].author, "alice");
});

test("getLeaderboard() respects the limit", () => {
  const store = new WeeklyLeaderboardStore();
  const now = Date.now();
  for (const author of ["a", "b", "c", "d"]) store.recordActivity(author, now);
  assert.equal(store.getLeaderboard(2, now).entries.length, 2);
});

test("getRank() returns 1-based rank, or null for an author with no activity", () => {
  const store = new WeeklyLeaderboardStore();
  const now = Date.now();
  store.recordPopularity("bob", now);
  store.recordActivity("alice", now);
  assert.equal(store.getRank("bob", now), 1);
  assert.equal(store.getRank("alice", now), 2);
  assert.equal(store.getRank("carol", now), null);
});

test("activity from a previous week doesn't carry into the current week's leaderboard", () => {
  const store = new WeeklyLeaderboardStore();
  const lastWeek = Date.now() - 8 * 24 * 60 * 60 * 1000;
  store.recordActivity("alice", lastWeek);
  const { entries } = store.getLeaderboard(10, Date.now());
  assert.equal(entries.length, 0);
});

test("recordActivity()/recordPopularity() ignore a missing author", () => {
  const store = new WeeklyLeaderboardStore();
  store.recordActivity("");
  store.recordPopularity("");
  assert.deepEqual(store.getLeaderboard().entries, []);
});
