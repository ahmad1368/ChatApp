import test from "node:test";
import assert from "node:assert/strict";
import { LoginStreakStore, LOGIN_STREAK_REWARDS } from "./loginStreak";

test("getStatus() starts at streak 0 with no last check-in date", () => {
  const store = new LoginStreakStore();
  const status = store.getStatus("alice");
  assert.equal(status.streak, 0);
  assert.equal(status.lastCheckInDate, null);
  assert.deepEqual(status.rewards, LOGIN_STREAK_REWARDS);
});

test("checkIn() rejects a missing author", () => {
  const store = new LoginStreakStore();
  assert.equal(store.checkIn("").success, false);
});

test("checkIn() starts a new streak at day 1 and awards its coin reward", () => {
  const store = new LoginStreakStore();
  const result = store.checkIn("alice");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.checkIn.streak, 1);
  assert.equal(result.checkIn.coinsAwarded, LOGIN_STREAK_REWARDS[0].coins);
  assert.equal(result.checkIn.alreadyCheckedInToday, false);
});

test("checkIn() is idempotent within the same day: no repeat coin award", () => {
  const store = new LoginStreakStore();
  store.checkIn("alice");
  const second = store.checkIn("alice");
  assert.equal(second.success, true);
  if (!second.success) return;
  assert.equal(second.checkIn.streak, 1);
  assert.equal(second.checkIn.coinsAwarded, 0);
  assert.equal(second.checkIn.alreadyCheckedInToday, true);
});

test("getStatus() reflects the streak and last check-in date after checking in", () => {
  const store = new LoginStreakStore();
  store.checkIn("alice");
  const status = store.getStatus("alice");
  assert.equal(status.streak, 1);
  assert.equal(status.lastCheckInDate, new Date().toISOString().slice(0, 10));
});

test("each author's streak is independent", () => {
  const store = new LoginStreakStore();
  store.checkIn("alice");
  assert.equal(store.getStatus("bob").streak, 0);
});
