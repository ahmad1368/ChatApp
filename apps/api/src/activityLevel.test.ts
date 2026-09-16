import { test } from "node:test";
import assert from "node:assert/strict";
import { computeActivityPercentile } from "./activityLevel";

test("returns 100 when there is no comparison data at all", () => {
  assert.equal(computeActivityPercentile(0, []), 100);
});

test("returns 100 for the most active author in the pool", () => {
  assert.equal(computeActivityPercentile(50, [10, 20, 50]), 100);
});

test("returns a lower percentile for a below-average author", () => {
  const result = computeActivityPercentile(10, [10, 20, 30, 40]);
  assert.equal(result, 25);
});

test("ties count toward the higher percentile", () => {
  const result = computeActivityPercentile(20, [10, 20, 20, 30]);
  assert.equal(result, 75);
});

test("a single-entry pool of just this author is 100", () => {
  assert.equal(computeActivityPercentile(5, [5]), 100);
});

test("zero activity in a pool of all zeros is still 100", () => {
  assert.equal(computeActivityPercentile(0, [0, 0, 0]), 100);
});
