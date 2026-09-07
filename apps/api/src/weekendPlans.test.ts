import { test } from "node:test";
import assert from "node:assert/strict";
import { WeekendPlansStore, WEEKEND_PLAN_CATALOG, MAX_SELECTED_WEEKEND_PLANS } from "./weekendPlans";

test("get() returns empty fields before any update", () => {
  const store = new WeekendPlansStore();
  assert.deepEqual(store.get("alice"), { weekendPlans: [], hideWeekendPlans: false });
});

test("update() rejects a missing author", () => {
  const store = new WeekendPlansStore();
  const result = store.update("", ["brunch"], false);
  assert.equal(result.success, false);
});

test("update() rejects a non-array weekendPlans value", () => {
  const store = new WeekendPlansStore();
  const result = store.update("alice", "brunch", false);
  assert.equal(result.success, false);
});

test("update() rejects more than the max number of weekend plans", () => {
  const store = new WeekendPlansStore();
  const result = store.update("alice", WEEKEND_PLAN_CATALOG.slice(0, MAX_SELECTED_WEEKEND_PLANS + 1), false);
  assert.equal(result.success, false);
});

test("update() rejects an unknown weekend plan", () => {
  const store = new WeekendPlansStore();
  const result = store.update("alice", ["time travel"], false);
  assert.equal(result.success, false);
});

test("update() rejects duplicate weekend plans", () => {
  const store = new WeekendPlansStore();
  const result = store.update("alice", ["brunch", "brunch"], false);
  assert.equal(result.success, false);
});

test("update() accepts an empty list", () => {
  const store = new WeekendPlansStore();
  const result = store.update("alice", [], false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { weekendPlans: [], hideWeekendPlans: false });
});

test("update() accepts valid weekend plans and hideWeekendPlans, then get() returns them", () => {
  const store = new WeekendPlansStore();
  const result = store.update("alice", ["brunch", "hiking"], true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { weekendPlans: ["brunch", "hiking"], hideWeekendPlans: true });
});

test("updating again replaces the previous list for that author", () => {
  const store = new WeekendPlansStore();
  store.update("alice", ["brunch"], false);
  store.update("alice", ["beach day", "game night"], false);
  assert.deepEqual(store.get("alice"), { weekendPlans: ["beach day", "game night"], hideWeekendPlans: false });
});

test("each author's weekend plans are independent", () => {
  const store = new WeekendPlansStore();
  store.update("alice", ["brunch"], false);
  assert.deepEqual(store.get("bob"), { weekendPlans: [], hideWeekendPlans: false });
});
