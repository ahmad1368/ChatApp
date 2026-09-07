import { test } from "node:test";
import assert from "node:assert/strict";
import { bioMatchesKeyword } from "./bioSearch";

test("bioMatchesKeyword() is true for any bio when the keyword is empty", () => {
  assert.equal(bioMatchesKeyword("I love hiking", ""), true);
  assert.equal(bioMatchesKeyword("", ""), true);
});

test("bioMatchesKeyword() is true for any bio when the keyword is whitespace-only", () => {
  assert.equal(bioMatchesKeyword("I love hiking", "   "), true);
});

test("bioMatchesKeyword() matches a substring", () => {
  assert.equal(bioMatchesKeyword("I love hiking on weekends", "hiking"), true);
});

test("bioMatchesKeyword() is case-insensitive on both sides", () => {
  assert.equal(bioMatchesKeyword("I LOVE Hiking", "hiking"), true);
  assert.equal(bioMatchesKeyword("i love hiking", "HIKING"), true);
});

test("bioMatchesKeyword() is false when the keyword isn't present", () => {
  assert.equal(bioMatchesKeyword("I love cooking", "hiking"), false);
});

test("bioMatchesKeyword() is false for an empty bio and a non-empty keyword", () => {
  assert.equal(bioMatchesKeyword("", "hiking"), false);
});

test("bioMatchesKeyword() trims surrounding whitespace on the keyword", () => {
  assert.equal(bioMatchesKeyword("I love hiking", "  hiking  "), true);
});
