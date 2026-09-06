import { test } from "node:test";
import assert from "node:assert/strict";
import { scanForContactInfo } from "./contactInfoDetector";

test("plain bio text has no matches", () => {
  assert.deepEqual(scanForContactInfo("I love hiking and coffee."), {
    containsPhoneNumber: false,
    containsAddress: false,
  });
});

test("detects a phone number written with dashes", () => {
  assert.equal(scanForContactInfo("Text me at 555-123-4567").containsPhoneNumber, true);
});

test("detects a phone number written with spaces and a country code", () => {
  assert.equal(scanForContactInfo("call +1 555 123 4567 anytime").containsPhoneNumber, true);
});

test("detects a phone number written as one contiguous digit run", () => {
  assert.equal(scanForContactInfo("hit me up 5551234567").containsPhoneNumber, true);
});

test("does not flag a short number like an age", () => {
  assert.equal(scanForContactInfo("28 years old, love to travel").containsPhoneNumber, false);
});

test("detects a street address", () => {
  assert.equal(scanForContactInfo("Come find me at 123 Main Street").containsAddress, true);
});

test("detects a street address abbreviation", () => {
  assert.equal(scanForContactInfo("I live at 42 Oak Ave").containsAddress, true);
});

test("does not flag a house number mentioned without a street word", () => {
  assert.equal(scanForContactInfo("I was born in 1998").containsAddress, false);
});

test("can flag both a phone number and an address in the same text", () => {
  const result = scanForContactInfo("Call 555-123-4567 or visit 123 Main Street");
  assert.equal(result.containsPhoneNumber, true);
  assert.equal(result.containsAddress, true);
});
