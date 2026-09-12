import test from "node:test";
import assert from "node:assert/strict";
import { buildConversionFunnel } from "./analyticsFunnel";

test("buildConversionFunnel() returns an empty array for no stages", () => {
  assert.deepEqual(buildConversionFunnel([]), []);
});

test("buildConversionFunnel() gives the first stage 100% for both conversion rates", () => {
  const result = buildConversionFunnel([{ key: "signup", label: "Signed up", count: 100 }]);
  assert.equal(result[0].conversionFromStart, 100);
  assert.equal(result[0].conversionFromPrevious, 100);
});

test("buildConversionFunnel() computes conversionFromStart relative to the first stage", () => {
  const result = buildConversionFunnel([
    { key: "signup", label: "Signed up", count: 200 },
    { key: "onboarded", label: "Completed onboarding", count: 50 },
  ]);
  assert.equal(result[1].conversionFromStart, 25);
});

test("buildConversionFunnel() computes conversionFromPrevious relative to the prior stage", () => {
  const result = buildConversionFunnel([
    { key: "signup", label: "Signed up", count: 200 },
    { key: "onboarded", label: "Completed onboarding", count: 50 },
    { key: "swiped", label: "Made a swipe", count: 25 },
  ]);
  assert.equal(result[1].conversionFromPrevious, 25);
  assert.equal(result[2].conversionFromPrevious, 50);
});

test("buildConversionFunnel() rounds to one decimal place", () => {
  const result = buildConversionFunnel([
    { key: "signup", label: "Signed up", count: 3 },
    { key: "onboarded", label: "Completed onboarding", count: 1 },
  ]);
  assert.equal(result[1].conversionFromStart, 33.3);
});

test("buildConversionFunnel() returns 0% for every stage when the funnel starts at zero", () => {
  const result = buildConversionFunnel([
    { key: "signup", label: "Signed up", count: 0 },
    { key: "onboarded", label: "Completed onboarding", count: 0 },
  ]);
  assert.equal(result[0].conversionFromStart, 100);
  assert.equal(result[1].conversionFromStart, 0);
  assert.equal(result[1].conversionFromPrevious, 0);
});

test("buildConversionFunnel() preserves the original key, label, and count", () => {
  const result = buildConversionFunnel([{ key: "signup", label: "Signed up", count: 42 }]);
  assert.equal(result[0].key, "signup");
  assert.equal(result[0].label, "Signed up");
  assert.equal(result[0].count, 42);
});
