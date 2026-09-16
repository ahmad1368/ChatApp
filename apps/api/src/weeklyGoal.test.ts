import { test } from "node:test";
import assert from "node:assert/strict";
import { WeeklyGoalStore } from "./weeklyGoal";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEK_1_START = 10 * WEEK_MS;

test("get() returns an empty goal before any update", () => {
  const store = new WeeklyGoalStore();
  assert.deepEqual(store.get("alice"), { goal: "", weekStartIso: null });
});

test("update() rejects a missing author", () => {
  const store = new WeeklyGoalStore();
  const result = store.update("", "Go on 2 dates");
  assert.equal(result.success, false);
});

test("update() sets the goal for the current week", () => {
  const store = new WeeklyGoalStore();
  const result = store.update("alice", "Go on 2 dates", WEEK_1_START);
  assert.equal(result.success, true);
  assert.equal(store.get("alice", WEEK_1_START).goal, "Go on 2 dates");
});

test("update() trims whitespace and truncates an overly long goal", () => {
  const store = new WeeklyGoalStore();
  store.update("alice", "  " + "x".repeat(200) + "  ", WEEK_1_START);
  assert.equal(store.get("alice", WEEK_1_START).goal.length, 140);
});

test("an empty goal update clears it", () => {
  const store = new WeeklyGoalStore();
  store.update("alice", "Go on 2 dates", WEEK_1_START);
  store.update("alice", "   ", WEEK_1_START);
  assert.deepEqual(store.get("alice", WEEK_1_START), { goal: "", weekStartIso: null });
});

test("a goal set in a previous week reads back as unset", () => {
  const store = new WeeklyGoalStore();
  store.update("alice", "Go on 2 dates", WEEK_1_START);
  const nextWeek = WEEK_1_START + WEEK_MS;
  assert.deepEqual(store.get("alice", nextWeek), { goal: "", weekStartIso: null });
});

test("weekStartIso reflects the real calendar week the goal was set for", () => {
  const store = new WeeklyGoalStore();
  store.update("alice", "Go on 2 dates", WEEK_1_START);
  assert.equal(store.get("alice", WEEK_1_START).weekStartIso, new Date(WEEK_1_START).toISOString());
});

test("each author's weekly goal is independent", () => {
  const store = new WeeklyGoalStore();
  store.update("alice", "Go on 2 dates", WEEK_1_START);
  assert.deepEqual(store.get("bob", WEEK_1_START), { goal: "", weekStartIso: null });
});
