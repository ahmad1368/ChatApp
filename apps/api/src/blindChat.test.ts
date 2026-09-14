import test from "node:test";
import assert from "node:assert/strict";
import { BlindChatStore, BLIND_CHAT_DURATION_MINUTES } from "./blindChat";

test("start() rejects missing or identical participants", () => {
  const store = new BlindChatStore();
  assert.equal(store.start("", "bob").success, false);
  assert.equal(store.start("alice", "alice").success, false);
});

test("start() begins with photos unrevealed and the full duration remaining", () => {
  const store = new BlindChatStore();
  const now = Date.now();
  const result = store.start("alice", "bob", now);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.status.photosRevealed, false);
  assert.equal(result.status.secondsRemaining, BLIND_CHAT_DURATION_MINUTES * 60);
});

test("start() is idempotent per pair regardless of argument order and doesn't reset the timer", () => {
  const store = new BlindChatStore();
  const start = Date.now();
  store.start("alice", "bob", start);
  const later = store.start("bob", "alice", start + 60_000);
  assert.equal(later.success, true);
  if (!later.success) return;
  assert.equal(later.status.secondsRemaining, BLIND_CHAT_DURATION_MINUTES * 60 - 60);
});

test("getStatus() reports photosRevealed true once the duration has elapsed", () => {
  const store = new BlindChatStore();
  const start = Date.now();
  store.start("alice", "bob", start);
  const status = store.getStatus("alice", "bob", start + BLIND_CHAT_DURATION_MINUTES * 60_000);
  assert.equal(status.success, true);
  if (!status.success) return;
  assert.equal(status.status.photosRevealed, true);
  assert.equal(status.status.secondsRemaining, 0);
});

test("getStatus() rejects a pair that never started blind chat", () => {
  const store = new BlindChatStore();
  assert.equal(store.getStatus("alice", "bob").success, false);
});

test("requestReveal() from only one side doesn't reveal photos early", () => {
  const store = new BlindChatStore();
  const start = Date.now();
  store.start("alice", "bob", start);
  const result = store.requestReveal("alice", "bob", start + 1000);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.status.photosRevealed, false);
  assert.equal(result.status.revealRequestedByMe, true);
  assert.equal(result.status.bothRequestedReveal, false);
});

test("requestReveal() from both sides reveals photos immediately, before the timer elapses", () => {
  const store = new BlindChatStore();
  const start = Date.now();
  store.start("alice", "bob", start);
  store.requestReveal("alice", "bob", start + 1000);
  const result = store.requestReveal("bob", "alice", start + 2000);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.status.bothRequestedReveal, true);
  assert.equal(result.status.photosRevealed, true);
});

test("requestReveal() rejects a pair that never started blind chat", () => {
  const store = new BlindChatStore();
  assert.equal(store.requestReveal("alice", "bob").success, false);
});
