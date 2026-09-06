import { test } from "node:test";
import assert from "node:assert/strict";
import { ContactBlockStore } from "./contactBlocks";

test("registerPhone() rejects missing author or short/invalid numbers", () => {
  const store = new ContactBlockStore();
  assert.equal(store.registerPhone("", "555-123-4567").success, false);
  assert.equal(store.registerPhone("alice", "12345").success, false);
  assert.equal(store.registerPhone("alice", "555-123-4567").success, true);
});

test("findMatchingAuthors() matches regardless of phone number formatting", () => {
  const store = new ContactBlockStore();
  store.registerPhone("bob", "(555) 123-4567");

  const matches = store.findMatchingAuthors("alice", ["555.123.4567", "000-000-0000"]);
  assert.deepEqual(matches, ["bob"]);
});

test("findMatchingAuthors() never returns the requesting author themself", () => {
  const store = new ContactBlockStore();
  store.registerPhone("alice", "5551234567");

  const matches = store.findMatchingAuthors("alice", ["5551234567"]);
  assert.deepEqual(matches, []);
});

test("findMatchingAuthors() dedupes and ignores non-string entries", () => {
  const store = new ContactBlockStore();
  store.registerPhone("bob", "5551234567");

  const matches = store.findMatchingAuthors("alice", ["5551234567", "555-123-4567", 12345, null]);
  assert.deepEqual(matches, ["bob"]);
});

test("registerPhone() re-registering moves the old hash mapping", () => {
  const store = new ContactBlockStore();
  store.registerPhone("bob", "5551234567");
  store.registerPhone("bob", "5559876543");

  assert.deepEqual(store.findMatchingAuthors("alice", ["5551234567"]), []);
  assert.deepEqual(store.findMatchingAuthors("alice", ["5559876543"]), ["bob"]);
});
