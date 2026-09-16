import { test } from "node:test";
import assert from "node:assert/strict";
import { KeywordBlacklistStore, bioContainsBlacklistedKeyword, MAX_KEYWORDS } from "./keywordBlacklist";

test("update() rejects a missing author", () => {
  const store = new KeywordBlacklistStore();
  const result = store.update("", ["smoking"]);
  assert.equal(result.success, false);
});

test("update() rejects a non-array keywords value", () => {
  const store = new KeywordBlacklistStore();
  const result = store.update("alice", "smoking");
  assert.equal(result.success, false);
});

test("update() rejects a non-string keyword", () => {
  const store = new KeywordBlacklistStore();
  const result = store.update("alice", [123]);
  assert.equal(result.success, false);
});

test("update() rejects too many keywords", () => {
  const store = new KeywordBlacklistStore();
  const keywords = Array.from({ length: MAX_KEYWORDS + 1 }, (_, i) => `keyword${i}`);
  const result = store.update("alice", keywords);
  assert.equal(result.success, false);
});

test("update() rejects an overly long keyword", () => {
  const store = new KeywordBlacklistStore();
  const result = store.update("alice", ["x".repeat(51)]);
  assert.equal(result.success, false);
});

test("update() trims, lowercases, and dedupes keywords", () => {
  const store = new KeywordBlacklistStore();
  const result = store.update("alice", ["  Smoking ", "smoking", "CRYPTO"]);
  assert.deepEqual(result, { success: true, keywords: ["smoking", "crypto"] });
});

test("update() skips blank entries", () => {
  const store = new KeywordBlacklistStore();
  const result = store.update("alice", ["smoking", "  ", ""]);
  assert.deepEqual(result, { success: true, keywords: ["smoking"] });
});

test("get() defaults to an empty list", () => {
  const store = new KeywordBlacklistStore();
  assert.deepEqual(store.get("alice"), []);
});

test("keywords are tracked independently per author", () => {
  const store = new KeywordBlacklistStore();
  store.update("alice", ["smoking"]);
  assert.deepEqual(store.get("bob"), []);
});

test("bioContainsBlacklistedKeyword() matches a substring case-insensitively", () => {
  assert.equal(bioContainsBlacklistedKeyword("I love SMOKING on weekends", ["smoking"]), true);
});

test("bioContainsBlacklistedKeyword() returns false with no match", () => {
  assert.equal(bioContainsBlacklistedKeyword("I love hiking", ["smoking"]), false);
});

test("bioContainsBlacklistedKeyword() returns false for an empty bio or keyword list", () => {
  assert.equal(bioContainsBlacklistedKeyword("", ["smoking"]), false);
  assert.equal(bioContainsBlacklistedKeyword("I love smoking", []), false);
});
