import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInterestCompatibility } from "./interestCompatibility";

test("computeInterestCompatibility() is 0 when either profile has no interests", () => {
  assert.equal(computeInterestCompatibility([], ["hiking"]), 0);
  assert.equal(computeInterestCompatibility(["hiking"], []), 0);
  assert.equal(computeInterestCompatibility([], []), 0);
});

test("computeInterestCompatibility() is 100 when both profiles share every interest", () => {
  assert.equal(computeInterestCompatibility(["hiking", "yoga"], ["hiking", "yoga"]), 100);
});

test("computeInterestCompatibility() is 0 when there's no overlap", () => {
  assert.equal(computeInterestCompatibility(["hiking"], ["gaming"]), 0);
});

test("computeInterestCompatibility() is the shared count over the average vector size", () => {
  // shared = 1, average size = (2 + 4) / 2 = 3, score = round(1/3 * 100) = 33
  assert.equal(computeInterestCompatibility(["hiking", "yoga"], ["hiking", "gaming", "reading", "cooking"]), 33);
});

test("computeInterestCompatibility() ignores duplicate entries within one profile's list", () => {
  assert.equal(computeInterestCompatibility(["hiking", "hiking"], ["hiking"]), 100);
});

test("computeInterestCompatibility() is symmetric", () => {
  const a = ["hiking", "yoga", "gaming"];
  const b = ["hiking", "reading"];
  assert.equal(computeInterestCompatibility(a, b), computeInterestCompatibility(b, a));
});
