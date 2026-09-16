import { test } from "node:test";
import assert from "node:assert/strict";
import { computeZodiacCompatibility } from "./zodiacCompatibility";

test("two signs of the same element score highest", () => {
  const result = computeZodiacCompatibility("aries", "leo");
  assert.equal(result.relationship, "same-element");
  assert.equal(result.score, 90);
  assert.equal(result.compatible, true);
});

test("fire and air are complementary", () => {
  const result = computeZodiacCompatibility("aries", "gemini");
  assert.equal(result.relationship, "complementary");
  assert.equal(result.compatible, true);
});

test("earth and water are complementary", () => {
  const result = computeZodiacCompatibility("taurus", "cancer");
  assert.equal(result.relationship, "complementary");
  assert.equal(result.compatible, true);
});

test("fire and water clash", () => {
  const result = computeZodiacCompatibility("aries", "cancer");
  assert.equal(result.relationship, "clashing");
  assert.equal(result.compatible, false);
});

test("earth and air clash", () => {
  const result = computeZodiacCompatibility("taurus", "gemini");
  assert.equal(result.relationship, "clashing");
  assert.equal(result.compatible, false);
});

test("fire and earth are neutral", () => {
  const result = computeZodiacCompatibility("aries", "taurus");
  assert.equal(result.relationship, "neutral");
  assert.equal(result.score, 50);
});

test("air and water are neutral", () => {
  const result = computeZodiacCompatibility("gemini", "cancer");
  assert.equal(result.relationship, "neutral");
});

test("compatibility is symmetric", () => {
  assert.deepEqual(computeZodiacCompatibility("aries", "cancer"), computeZodiacCompatibility("cancer", "aries"));
});
