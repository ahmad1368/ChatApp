import { test } from "node:test";
import assert from "node:assert/strict";
import { MatchTimerStore } from "./matchTimer";

test("getTimer() returns undefined for an untracked pair", () => {
  const store = new MatchTimerStore();
  assert.equal(store.getTimer("alice", "bob"), undefined);
});

test("recordMatch() then getTimer() reports elapsed time since the match", () => {
  const store = new MatchTimerStore();
  const matchedAt = Date.now() - 5000;
  store.recordMatch("alice", "bob", matchedAt);
  const timer = store.getTimer("alice", "bob", matchedAt + 5000);
  assert.equal(timer?.timeTogetherMs, 5000);
  assert.equal(timer?.matchedAt, new Date(matchedAt).toISOString());
});

test("recordMatch() is order-independent (unordered pair)", () => {
  const store = new MatchTimerStore();
  const matchedAt = Date.now();
  store.recordMatch("alice", "bob", matchedAt);
  assert.deepEqual(store.getTimer("bob", "alice", matchedAt), store.getTimer("alice", "bob", matchedAt));
});

test("recordMatch() is a no-op if the pair is already tracked", () => {
  const store = new MatchTimerStore();
  const firstMatchedAt = Date.now() - 10_000;
  store.recordMatch("alice", "bob", firstMatchedAt);
  store.recordMatch("alice", "bob", Date.now());
  assert.equal(store.getTimer("alice", "bob", Date.now())?.matchedAt, new Date(firstMatchedAt).toISOString());
});

test("time together never goes negative even if now is somehow before matchedAt", () => {
  const store = new MatchTimerStore();
  const matchedAt = Date.now();
  store.recordMatch("alice", "bob", matchedAt);
  assert.equal(store.getTimer("alice", "bob", matchedAt - 1000)?.timeTogetherMs, 0);
});

test("each pair's timer is independent", () => {
  const store = new MatchTimerStore();
  store.recordMatch("alice", "bob", Date.now());
  assert.equal(store.getTimer("alice", "carol"), undefined);
});
