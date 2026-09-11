import { test } from "node:test";
import assert from "node:assert/strict";
import { scanForInappropriateContent } from "./contentWarning";

test("ordinary conversation is not flagged", () => {
  assert.deepEqual(scanForInappropriateContent("Hey, how was your weekend?"), { flagged: false });
});

test("flags a harassment phrase", () => {
  const result = scanForInappropriateContent("honestly you should just kill yourself");
  assert.equal(result.flagged, true);
  assert.equal(result.reason, "harassment");
});

test("harassment phrase matching is case-insensitive", () => {
  assert.equal(scanForInappropriateContent("KYS").flagged, true);
});

test("flags standalone profanity", () => {
  const result = scanForInappropriateContent("what the fuck is wrong with you");
  assert.equal(result.flagged, true);
  assert.equal(result.reason, "profanity");
});

test("profanity is matched as a whole word, not a substring", () => {
  assert.equal(scanForInappropriateContent("that's a hard class, glad I passed").flagged, false);
});

test("mild frustration on its own is not flagged", () => {
  assert.equal(scanForInappropriateContent("I hate waiting in line, so annoying").flagged, false);
});
