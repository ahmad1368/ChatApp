import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileBoostStore, BOOST_DURATION_MS } from "./profileBoost";

test("isBoosted() is false before any activation", () => {
  const store = new ProfileBoostStore();
  assert.equal(store.isBoosted("alice"), false);
});

test("getStatus() reports inactive before any activation", () => {
  const store = new ProfileBoostStore();
  assert.deepEqual(store.getStatus("alice"), { active: false, expiresAt: null });
});

test("activateBoost() rejects a missing author", () => {
  const store = new ProfileBoostStore();
  const result = store.activateBoost("");
  assert.equal(result.success, false);
});

test("activateBoost() makes isBoosted() true immediately", () => {
  const store = new ProfileBoostStore();
  const now = Date.now();
  store.activateBoost("alice", now);
  assert.equal(store.isBoosted("alice", now), true);
});

test("activateBoost() expires exactly after BOOST_DURATION_MS", () => {
  const store = new ProfileBoostStore();
  const now = Date.now();
  store.activateBoost("alice", now);
  assert.equal(store.isBoosted("alice", now + BOOST_DURATION_MS - 1), true);
  assert.equal(store.isBoosted("alice", now + BOOST_DURATION_MS + 1), false);
});

test("getStatus() reports the expiry timestamp while active", () => {
  const store = new ProfileBoostStore();
  const now = Date.now();
  const result = store.activateBoost("alice", now);
  assert.equal(result.success, true);
  const status = store.getStatus("alice", now);
  assert.equal(status.active, true);
  assert.equal(status.expiresAt, result.success ? result.expiresAt : undefined);
});

test("activateBoost() resets the window rather than stacking duration", () => {
  const store = new ProfileBoostStore();
  const now = Date.now();
  store.activateBoost("alice", now);
  store.activateBoost("alice", now + 1000);
  assert.equal(store.isBoosted("alice", now + BOOST_DURATION_MS - 1), true);
  assert.equal(store.isBoosted("alice", now + BOOST_DURATION_MS + 500), true);
  assert.equal(store.isBoosted("alice", now + BOOST_DURATION_MS + 1500), false);
});

test("boost status is independent per author", () => {
  const store = new ProfileBoostStore();
  store.activateBoost("alice");
  assert.equal(store.isBoosted("bob"), false);
});
