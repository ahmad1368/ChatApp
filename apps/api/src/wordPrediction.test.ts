import { test } from "node:test";
import assert from "node:assert/strict";
import { predictNextWords } from "./wordPrediction";

test("predictNextWords() returns matches ranked by frequency, highest first", () => {
  const result = predictNextWords("th");
  assert.deepEqual(result.slice(0, 2), ["the", "that"]);
});

test("predictNextWords() is case-insensitive", () => {
  assert.deepEqual(predictNextWords("TH").slice(0, 1), ["the"]);
});

test("predictNextWords() excludes an exact match to the prefix itself", () => {
  const result = predictNextWords("you");
  assert.ok(!result.includes("you"));
  assert.ok(result.includes("your"));
});

test("predictNextWords() returns an empty array for an empty or whitespace prefix", () => {
  assert.deepEqual(predictNextWords(""), []);
  assert.deepEqual(predictNextWords("   "), []);
});

test("predictNextWords() returns an empty array for a prefix matching nothing", () => {
  assert.deepEqual(predictNextWords("zzzzz"), []);
});

test("predictNextWords() respects the limit", () => {
  const result = predictNextWords("t", 2);
  assert.equal(result.length, 2);
});

test("predictNextWords() ignores a non-string prefix", () => {
  assert.deepEqual(predictNextWords(undefined), []);
  assert.deepEqual(predictNextWords(42), []);
});
