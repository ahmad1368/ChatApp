import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameTargetCountry } from "./targetImmigrationCountryMatch";

test("returns true when both target the same country", () => {
  assert.equal(isSameTargetCountry("canada", "canada"), true);
});

test("returns false for different countries", () => {
  assert.equal(isSameTargetCountry("canada", "germany"), false);
});

test("returns false when either side has no target country", () => {
  assert.equal(isSameTargetCountry(null, "canada"), false);
  assert.equal(isSameTargetCountry("canada", null), false);
  assert.equal(isSameTargetCountry(null, null), false);
});
