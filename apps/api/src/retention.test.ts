import test from "node:test";
import assert from "node:assert/strict";
import { computeRetention } from "./retention";

const DAY_MS = 24 * 60 * 60 * 1000;

test("computeRetention() excludes users not old enough to qualify for a window", () => {
  const now = Date.now();
  const users = [{ createdAtMs: now - 3 * DAY_MS, lastActiveAtMs: now }];
  const [day1, day7] = computeRetention(users, [1, 7], now);
  assert.equal(day1.eligibleUsers, 1);
  assert.equal(day7.eligibleUsers, 0);
  assert.equal(day7.retentionRate, 0);
});

test("computeRetention() counts a user retained when last activity is far enough after signup", () => {
  const now = Date.now();
  const users = [
    { createdAtMs: now - 10 * DAY_MS, lastActiveAtMs: now }, // active 10 days after signup
    { createdAtMs: now - 10 * DAY_MS, lastActiveAtMs: now - 9 * DAY_MS }, // only active 1 day after signup
  ];
  const [day7] = computeRetention(users, [7], now);
  assert.equal(day7.eligibleUsers, 2);
  assert.equal(day7.retainedUsers, 1);
  assert.equal(day7.retentionRate, 0.5);
});

test("computeRetention() treats a missing lastActiveAtMs as never having returned", () => {
  const now = Date.now();
  const users = [{ createdAtMs: now - 10 * DAY_MS, lastActiveAtMs: undefined }];
  const [day7] = computeRetention(users, [7], now);
  assert.equal(day7.eligibleUsers, 1);
  assert.equal(day7.retainedUsers, 0);
});

test("computeRetention() returns a 0 rate rather than dividing by zero when nobody is eligible", () => {
  const now = Date.now();
  const [day30] = computeRetention([{ createdAtMs: now, lastActiveAtMs: now }], [30], now);
  assert.equal(day30.eligibleUsers, 0);
  assert.equal(day30.retentionRate, 0);
});

test("computeRetention() returns one result per requested window, in order", () => {
  const now = Date.now();
  const results = computeRetention([], [1, 7, 30], now);
  assert.deepEqual(
    results.map((r) => r.windowDays),
    [1, 7, 30]
  );
});
