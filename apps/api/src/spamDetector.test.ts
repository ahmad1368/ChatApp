import { test } from "node:test";
import assert from "node:assert/strict";
import { scanForSpamContent } from "./spamDetector";

test("ordinary conversation is not flagged", () => {
  assert.deepEqual(scanForSpamContent("Hey, want to grab coffee this weekend?"), { flagged: false });
});

test("flags a message containing a link", () => {
  const result = scanForSpamContent("check this out https://example.com/promo");
  assert.equal(result.flagged, true);
  assert.equal(result.reason, "url");
});

test("flags a common promotional phrase", () => {
  const result = scanForSpamContent("Follow me on Instagram for more!");
  assert.equal(result.flagged, true);
  assert.equal(result.reason, "promo_phrase");
});

test("promotional phrase matching is case-insensitive", () => {
  assert.equal(scanForSpamContent("CHECK OUT MY ONLYFANS").flagged, true);
});

test("mentioning instagram casually without the promo phrasing is not flagged", () => {
  assert.equal(scanForSpamContent("I saw your photos on Instagram, they're great").flagged, false);
});
