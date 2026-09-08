import { test } from "node:test";
import assert from "node:assert/strict";
import { MatchExpiryStore, MATCH_RESPONSE_WINDOW_MS } from "./matchExpiry";

test("isExpired() is false for a pair that was never matched", () => {
  const store = new MatchExpiryStore();
  assert.equal(store.isExpired("alice", "bob"), false);
});

test("isExpired() is false right after matching", () => {
  const store = new MatchExpiryStore();
  store.recordMatch("alice", "bob");
  assert.equal(store.isExpired("alice", "bob"), false);
});

test("isExpired() is true once the window passes with no first message", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  assert.equal(store.isExpired("alice", "bob", now + MATCH_RESPONSE_WINDOW_MS + 1000), true);
});

test("isExpired() is false right at the edge of the window", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  assert.equal(store.isExpired("alice", "bob", now + MATCH_RESPONSE_WINDOW_MS), false);
});

test("isExpired() stays false once a first message was recorded, even long after", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  store.recordFirstMessage("alice", "bob", now + 1000);
  assert.equal(store.isExpired("alice", "bob", now + MATCH_RESPONSE_WINDOW_MS + 1000), false);
});

test("recordMatch() is order-independent — matching A/B is the same pair as B/A", () => {
  const store = new MatchExpiryStore();
  store.recordMatch("alice", "bob");
  assert.deepEqual(store.getState("bob", "alice"), store.getState("alice", "bob"));
});

test("recordMatch() does not reset an existing match's timestamp", () => {
  const store = new MatchExpiryStore();
  const firstMatchTime = Date.now() - 1000;
  store.recordMatch("alice", "bob", firstMatchTime);
  store.recordMatch("alice", "bob", Date.now());
  assert.equal(store.getState("alice", "bob")?.matchedAt, new Date(firstMatchTime).toISOString());
});

test("recordFirstMessage() does nothing for a pair that was never matched", () => {
  const store = new MatchExpiryStore();
  store.recordFirstMessage("alice", "bob");
  assert.equal(store.getState("alice", "bob"), undefined);
});

test("recordFirstMessage() only sets the timestamp once", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  store.recordFirstMessage("alice", "bob", now + 100);
  store.recordFirstMessage("alice", "bob", now + 200);
  assert.equal(store.getState("alice", "bob")?.firstMessageSentAt, new Date(now + 100).toISOString());
});

test("getState() returns undefined for an untracked pair", () => {
  const store = new MatchExpiryStore();
  assert.equal(store.getState("alice", "bob"), undefined);
});
