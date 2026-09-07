import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWeekendPlanMatch } from "./weekendPlanMatch";

test("computeWeekendPlanMatch() finds no shared plans between disjoint lists", () => {
  const result = computeWeekendPlanMatch(["brunch"], ["hiking"]);
  assert.deepEqual(result.sharedPlans, []);
  assert.equal(result.compatibility, 0);
});

test("computeWeekendPlanMatch() lists the plans both authors have in common", () => {
  const result = computeWeekendPlanMatch(["brunch", "hiking", "beach day"], ["hiking", "beach day", "gym session"]);
  assert.deepEqual(result.sharedPlans, ["hiking", "beach day"]);
});

test("computeWeekendPlanMatch() is 100% compatible when both lists are identical", () => {
  const result = computeWeekendPlanMatch(["brunch", "hiking"], ["brunch", "hiking"]);
  assert.equal(result.compatibility, 100);
});

test("computeWeekendPlanMatch() is 0% with an empty plan list on either side", () => {
  assert.equal(computeWeekendPlanMatch([], ["brunch"]).compatibility, 0);
  assert.equal(computeWeekendPlanMatch(["brunch"], []).compatibility, 0);
});
