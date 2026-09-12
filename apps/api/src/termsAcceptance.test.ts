import { test } from "node:test";
import assert from "node:assert/strict";
import { TermsAcceptanceStore, CURRENT_TERMS_VERSION } from "./termsAcceptance";

test("get() is null before anything happens", () => {
  const store = new TermsAcceptanceStore();
  assert.equal(store.get("alice"), null);
});

test("hasAcceptedCurrent() is false before anything happens", () => {
  const store = new TermsAcceptanceStore();
  assert.equal(store.hasAcceptedCurrent("alice"), false);
});

test("recordAcceptance() rejects a missing author", () => {
  const store = new TermsAcceptanceStore();
  const result = store.recordAcceptance("");
  assert.deepEqual(result, { success: false, error: "author is required" });
});

test("recordAcceptance() records the current version and timestamp", () => {
  const store = new TermsAcceptanceStore();
  const result = store.recordAcceptance("alice");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.acceptance.version, CURRENT_TERMS_VERSION);
    assert.ok(result.acceptance.acceptedAt);
  }
  assert.equal(store.hasAcceptedCurrent("alice"), true);
});

test("acceptance is independent per author", () => {
  const store = new TermsAcceptanceStore();
  store.recordAcceptance("alice");
  assert.equal(store.get("bob"), null);
});
