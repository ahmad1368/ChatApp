import test from "node:test";
import assert from "node:assert/strict";
import { cleanMessageBeforeSending } from "./messageCleanupFilter";

test("leaves a clean message unmodified", () => {
  const result = cleanMessageBeforeSending("hey, how was your weekend?");
  assert.equal(result.wasModified, false);
  assert.equal(result.cleaned, "hey, how was your weekend?");
  assert.deepEqual(result.removedReasons, []);
});

test("masks profanity the same way #176's filterProfanity does", () => {
  const result = cleanMessageBeforeSending("what the fuck is going on");
  assert.ok(result.wasModified);
  assert.ok(result.removedReasons.includes("profanity"));
  assert.ok(!result.cleaned.includes("fuck"));
  assert.ok(result.cleaned.includes("f***"));
});

test("redacts a known spam/promo phrase", () => {
  const result = cleanMessageBeforeSending("hey check out my onlyfans for more pics");
  assert.ok(result.wasModified);
  assert.ok(result.removedReasons.includes("spam_phrase"));
  assert.ok(result.cleaned.includes("[removed]"));
  assert.ok(!result.cleaned.toLowerCase().includes("onlyfans"));
});

test("redacts a URL", () => {
  const result = cleanMessageBeforeSending("check this out https://example.com/promo");
  assert.ok(result.wasModified);
  assert.ok(result.removedReasons.includes("url"));
  assert.ok(result.cleaned.includes("[link removed]"));
  assert.ok(!result.cleaned.includes("https://"));
});

test("handles a message with multiple issues at once", () => {
  const result = cleanMessageBeforeSending("this is such fucking bullshit, click the link in my bio https://spam.example.com");
  assert.ok(result.removedReasons.includes("profanity"));
  assert.ok(result.removedReasons.includes("spam_phrase"));
  assert.ok(result.removedReasons.includes("url"));
});

test("redacts every occurrence of a repeated spam phrase, not just the first", () => {
  const result = cleanMessageBeforeSending("follow me on instagram! seriously, follow me on instagram!");
  const matches = result.cleaned.match(/\[removed\]/g) ?? [];
  assert.equal(matches.length, 2);
});
