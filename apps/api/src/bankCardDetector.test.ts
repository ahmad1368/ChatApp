import { test } from "node:test";
import assert from "node:assert/strict";
import { scanForBankCardNumber } from "./bankCardDetector";

test("flags a valid card number with no separators", () => {
  const result = scanForBankCardNumber("here's my card 4111111111111111 for the deposit");
  assert.equal(result.flagged, true);
});

test("flags a valid card number with spaces", () => {
  const result = scanForBankCardNumber("4111 1111 1111 1111");
  assert.equal(result.flagged, true);
});

test("flags a valid card number with dashes", () => {
  const result = scanForBankCardNumber("4111-1111-1111-1111");
  assert.equal(result.flagged, true);
});

test("flags a valid Mastercard test number", () => {
  const result = scanForBankCardNumber("5500005555555559");
  assert.equal(result.flagged, true);
});

test("does not flag plain text with no digits", () => {
  const result = scanForBankCardNumber("hey, want to grab coffee sometime?");
  assert.equal(result.flagged, false);
});

test("does not flag a digit run that fails the Luhn check", () => {
  const result = scanForBankCardNumber("4111111111111112");
  assert.equal(result.flagged, false);
});

test("does not flag a short digit run like a phone number", () => {
  const result = scanForBankCardNumber("call me at 555-123-4567");
  assert.equal(result.flagged, false);
});

test("does not flag an empty string", () => {
  const result = scanForBankCardNumber("");
  assert.equal(result.flagged, false);
});
