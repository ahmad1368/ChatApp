import { test } from "node:test";
import assert from "node:assert/strict";
import { extractKeywords, computeBioMatch } from "./bioAnalysis";

test("extractKeywords() lowercases and strips punctuation", () => {
  assert.deepEqual(extractKeywords("Coffee, hiking, and photography!"), ["coffee", "hiking", "photography"]);
});

test("extractKeywords() removes stopwords", () => {
  assert.deepEqual(extractKeywords("I am a big fan of the outdoors"), ["big", "fan", "outdoors"]);
});

test("extractKeywords() removes words shorter than the minimum length", () => {
  assert.deepEqual(extractKeywords("I go to the gym a lot"), ["gym", "lot"]);
});

test("extractKeywords() dedupes repeated words", () => {
  assert.deepEqual(extractKeywords("coffee coffee coffee"), ["coffee"]);
});

test("extractKeywords() returns an empty list for an empty bio", () => {
  assert.deepEqual(extractKeywords(""), []);
});

test("computeBioMatch() finds no shared keywords between unrelated bios", () => {
  const result = computeBioMatch("I love hiking and camping", "Big fan of cooking and baking");
  assert.deepEqual(result.sharedKeywords, []);
  assert.equal(result.compatibility, 0);
});

test("computeBioMatch() lists the keywords both bios have in common", () => {
  const result = computeBioMatch("I love hiking and coffee", "Coffee lover who also enjoys hiking");
  assert.deepEqual(result.sharedKeywords.sort(), ["coffee", "hiking"]);
});

test("computeBioMatch() is 0% when either bio has no meaningful keywords", () => {
  assert.equal(computeBioMatch("", "I love hiking").compatibility, 0);
  assert.equal(computeBioMatch("I love hiking", "").compatibility, 0);
});
