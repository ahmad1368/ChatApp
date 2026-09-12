import test from "node:test";
import assert from "node:assert/strict";
import { filterProfanity } from "./profanityFilter";

test("filterProfanity() leaves clean text untouched", () => {
  const result = filterProfanity("Hey, want to grab coffee this weekend?");
  assert.equal(result.wasFiltered, false);
  assert.equal(result.filtered, "Hey, want to grab coffee this weekend?");
});

test("filterProfanity() masks a standalone profanity word, keeping the first letter", () => {
  const result = filterProfanity("this is such bullshit honestly");
  assert.equal(result.wasFiltered, false);
  assert.equal(result.filtered, "this is such bullshit honestly");
});

test("filterProfanity() masks an exact profanity word match", () => {
  const result = filterProfanity("what the shit is going on");
  assert.equal(result.wasFiltered, true);
  assert.equal(result.filtered, "what the s*** is going on");
});

test("filterProfanity() does not trip on unrelated substrings", () => {
  const result = filterProfanity("I'm taking a class on assassins");
  assert.equal(result.wasFiltered, false);
  assert.equal(result.filtered, "I'm taking a class on assassins");
});

test("filterProfanity() masks multiple occurrences in the same text", () => {
  const result = filterProfanity("fuck this, fuck that");
  assert.equal(result.wasFiltered, true);
  assert.equal(result.filtered, "f*** this, f*** that");
});

test("filterProfanity() is case-insensitive but preserves the original casing pattern via first letter", () => {
  const result = filterProfanity("SHIT happens");
  assert.equal(result.wasFiltered, true);
  assert.equal(result.filtered, "S*** happens");
});

test("filterProfanity() handles empty text", () => {
  const result = filterProfanity("");
  assert.equal(result.wasFiltered, false);
  assert.equal(result.filtered, "");
});
