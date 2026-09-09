import { test } from "node:test";
import assert from "node:assert/strict";
import { MatchExpiryStore, MATCH_RESPONSE_WINDOW_MS, MATCH_EXPIRY_REMINDER_LEAD_MS } from "./matchExpiry";

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

test("extend() rejects an untracked pair", () => {
  const store = new MatchExpiryStore();
  const result = store.extend("alice", "bob");
  assert.equal(result.allowed, false);
  assert.match(result.error ?? "", /no tracked match/i);
});

test("extend() pushes the deadline back by another full window", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  const justBeforeOriginalExpiry = now + MATCH_RESPONSE_WINDOW_MS - 1000;
  const result = store.extend("alice", "bob", justBeforeOriginalExpiry);
  assert.equal(result.allowed, true);
  assert.equal(store.isExpired("alice", "bob", justBeforeOriginalExpiry + 2000), false);
  assert.equal(store.isExpired("alice", "bob", now + 2 * MATCH_RESPONSE_WINDOW_MS + 1000), true);
});

test("extend() is order-independent", () => {
  const store = new MatchExpiryStore();
  store.recordMatch("alice", "bob");
  const result = store.extend("bob", "alice");
  assert.equal(result.allowed, true);
  assert.equal(store.getState("alice", "bob")?.extended, true);
});

test("extend() can only be used once per match", () => {
  const store = new MatchExpiryStore();
  store.recordMatch("alice", "bob");
  assert.equal(store.extend("alice", "bob").allowed, true);
  const second = store.extend("alice", "bob");
  assert.equal(second.allowed, false);
  assert.match(second.error ?? "", /already been extended/i);
});

test("extend() is rejected once a first message has been sent", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  store.recordFirstMessage("alice", "bob", now + 1000);
  const result = store.extend("alice", "bob", now + 2000);
  assert.equal(result.allowed, false);
  assert.match(result.error ?? "", /conversation started/i);
});

test("extend() is rejected once the match has already expired", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  const result = store.extend("alice", "bob", now + MATCH_RESPONSE_WINDOW_MS + 1000);
  assert.equal(result.allowed, false);
  assert.match(result.error ?? "", /already expired/i);
});

test("needsExpiryReminder() is false right after matching (not yet in the lead-time window)", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  assert.equal(store.needsExpiryReminder("alice", "bob", now + 1000), false);
});

test("needsExpiryReminder() is true once inside the reminder lead-time window", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  const insideWindow = now + MATCH_RESPONSE_WINDOW_MS - MATCH_EXPIRY_REMINDER_LEAD_MS + 1000;
  assert.equal(store.needsExpiryReminder("alice", "bob", insideWindow), true);
});

test("needsExpiryReminder() is false once a first message has been sent", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  store.recordFirstMessage("alice", "bob", now + 1000);
  const insideWindow = now + MATCH_RESPONSE_WINDOW_MS - MATCH_EXPIRY_REMINDER_LEAD_MS + 1000;
  assert.equal(store.needsExpiryReminder("alice", "bob", insideWindow), false);
});

test("needsExpiryReminder() is false once the match has already expired", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  assert.equal(store.needsExpiryReminder("alice", "bob", now + MATCH_RESPONSE_WINDOW_MS + 1000), false);
});

test("needsExpiryReminder() is false for an untracked pair", () => {
  const store = new MatchExpiryStore();
  assert.equal(store.needsExpiryReminder("alice", "bob"), false);
});

test("markReminderSent() makes needsExpiryReminder() false afterward, even still inside the window", () => {
  const store = new MatchExpiryStore();
  const now = Date.now();
  store.recordMatch("alice", "bob", now);
  const insideWindow = now + MATCH_RESPONSE_WINDOW_MS - MATCH_EXPIRY_REMINDER_LEAD_MS + 1000;
  store.markReminderSent("alice", "bob", insideWindow);
  assert.equal(store.needsExpiryReminder("alice", "bob", insideWindow + 1000), false);
});

test("getAllPairs() lists every tracked match as an [a, b] tuple", () => {
  const store = new MatchExpiryStore();
  store.recordMatch("alice", "bob");
  store.recordMatch("carol", "dave");
  const pairs = store.getAllPairs().map((pair) => [...pair].sort());
  assert.deepEqual(
    pairs.sort(),
    [
      ["alice", "bob"],
      ["carol", "dave"],
    ].sort()
  );
});

test("getAllPairs() is empty when no match has ever been recorded", () => {
  const store = new MatchExpiryStore();
  assert.deepEqual(store.getAllPairs(), []);
});
