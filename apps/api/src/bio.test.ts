import { test } from "node:test";
import assert from "node:assert/strict";
import { BioStore, MAX_BIO_LENGTH } from "./bio";

test("get() returns an empty string before any update", () => {
  const store = new BioStore();
  assert.equal(store.get("alice"), "");
});

test("update() rejects a missing author", () => {
  const store = new BioStore();
  const result = store.update("", "Hello there");
  assert.equal(result.success, false);
});

test("update() rejects a bio over the character limit", () => {
  const store = new BioStore();
  const result = store.update("alice", "a".repeat(MAX_BIO_LENGTH + 1));
  assert.equal(result.success, false);
});

test("update() accepts a bio at exactly the character limit", () => {
  const store = new BioStore();
  const bio = "a".repeat(MAX_BIO_LENGTH);
  const result = store.update("alice", bio);
  assert.equal(result.success, true);
  assert.equal(store.get("alice"), bio);
});

test("update() rejects a bio containing a phone number", () => {
  const store = new BioStore();
  const result = store.update("alice", "call me at 555-123-4567");
  assert.equal(result.success, false);
});

test("update() rejects a bio containing a street address", () => {
  const store = new BioStore();
  const result = store.update("alice", "I live at 221 Baker Street");
  assert.equal(result.success, false);
});

test("update() trims whitespace and accepts a valid bio", () => {
  const store = new BioStore();
  const result = store.update("alice", "  Loves hiking and coffee  ");
  assert.equal(result.success, true);
  assert.equal(store.get("alice"), "Loves hiking and coffee");
});

test("updating again replaces the previous bio for that author", () => {
  const store = new BioStore();
  store.update("alice", "First bio");
  store.update("alice", "Second bio");
  assert.equal(store.get("alice"), "Second bio");
});

test("each author's bio is independent", () => {
  const store = new BioStore();
  store.update("alice", "Alice's bio");
  assert.equal(store.get("bob"), "");
});
