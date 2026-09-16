import { test } from "node:test";
import assert from "node:assert/strict";
import { canSendGivenAgeLimit } from "./messageAgeLimitRule";

test("allowed when the sender has no self-reported age", () => {
  const result = canSendGivenAgeLimit(null, { minAge: 25, maxAge: 40 });
  assert.deepEqual(result, { allowed: true });
});

test("allowed when the recipient has no limit set", () => {
  const result = canSendGivenAgeLimit(22, { minAge: null, maxAge: null });
  assert.deepEqual(result, { allowed: true });
});

test("allowed when the sender's age is within the range", () => {
  const result = canSendGivenAgeLimit(30, { minAge: 25, maxAge: 40 });
  assert.deepEqual(result, { allowed: true });
});

test("blocked when the sender's age is below minAge", () => {
  const result = canSendGivenAgeLimit(20, { minAge: 25, maxAge: 40 });
  assert.equal(result.allowed, false);
});

test("blocked when the sender's age is above maxAge", () => {
  const result = canSendGivenAgeLimit(50, { minAge: 25, maxAge: 40 });
  assert.equal(result.allowed, false);
});

test("allowed at the exact minAge boundary", () => {
  const result = canSendGivenAgeLimit(25, { minAge: 25, maxAge: 40 });
  assert.deepEqual(result, { allowed: true });
});

test("allowed at the exact maxAge boundary", () => {
  const result = canSendGivenAgeLimit(40, { minAge: 25, maxAge: 40 });
  assert.deepEqual(result, { allowed: true });
});

test("blocked with only a minAge set and the sender below it", () => {
  const result = canSendGivenAgeLimit(20, { minAge: 25, maxAge: null });
  assert.equal(result.allowed, false);
});

test("blocked with only a maxAge set and the sender above it", () => {
  const result = canSendGivenAgeLimit(50, { minAge: null, maxAge: 40 });
  assert.equal(result.allowed, false);
});
