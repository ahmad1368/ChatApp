import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileBoostStore, BOOST_DURATION_MS } from "./profileBoost";

test("isBoosted() is false before any activation", () => {
  const store = new ProfileBoostStore();
  assert.equal(store.isBoosted("alice"), false);
});

test("getBoostLevel() is 0 before any activation", () => {
  const store = new ProfileBoostStore();
  assert.equal(store.getBoostLevel("alice"), 0);
});

test("getStatus() reports inactive before any activation", () => {
  const store = new ProfileBoostStore();
  assert.deepEqual(store.getStatus("alice"), { active: false, tier: null, expiresAt: null });
});

test("activateBoost() rejects a missing author", () => {
  const store = new ProfileBoostStore();
  const result = store.activateBoost("", undefined);
  assert.equal(result.success, false);
});

test("activateBoost() rejects an invalid tier", () => {
  const store = new ProfileBoostStore();
  const result = store.activateBoost("alice", "mega-boost");
  assert.equal(result.success, false);
});

test("activateBoost() defaults to the boost tier when none is given", () => {
  const store = new ProfileBoostStore();
  const result = store.activateBoost("alice", undefined);
  assert.equal(result.success, true);
  assert.equal(result.success && result.tier, "boost");
});

test("activateBoost() makes isBoosted() true immediately", () => {
  const store = new ProfileBoostStore();
  const now = Date.now();
  store.activateBoost("alice", "boost", now);
  assert.equal(store.isBoosted("alice", now), true);
});

test("activateBoost() expires exactly after BOOST_DURATION_MS", () => {
  const store = new ProfileBoostStore();
  const now = Date.now();
  store.activateBoost("alice", "boost", now);
  assert.equal(store.isBoosted("alice", now + BOOST_DURATION_MS - 1), true);
  assert.equal(store.isBoosted("alice", now + BOOST_DURATION_MS + 1), false);
});

test("getStatus() reports the tier and expiry timestamp while active", () => {
  const store = new ProfileBoostStore();
  const now = Date.now();
  const result = store.activateBoost("alice", "superboost", now);
  assert.equal(result.success, true);
  const status = store.getStatus("alice", now);
  assert.equal(status.active, true);
  assert.equal(status.tier, "superboost");
  assert.equal(status.expiresAt, result.success ? result.expiresAt : undefined);
});

test("activateBoost() resets the window and tier rather than stacking duration", () => {
  const store = new ProfileBoostStore();
  const now = Date.now();
  store.activateBoost("alice", "boost", now);
  store.activateBoost("alice", "superboost", now + 1000);
  assert.equal(store.isBoosted("alice", now + BOOST_DURATION_MS - 1), true);
  assert.equal(store.isBoosted("alice", now + BOOST_DURATION_MS + 500), true);
  assert.equal(store.isBoosted("alice", now + BOOST_DURATION_MS + 1500), false);
  assert.equal(store.getStatus("alice", now + 1000).tier, "superboost");
});

test("boost status is independent per author", () => {
  const store = new ProfileBoostStore();
  store.activateBoost("alice", undefined);
  assert.equal(store.isBoosted("bob"), false);
});

test("getBoostLevel() ranks superboost above boost, and boost above nothing", () => {
  const store = new ProfileBoostStore();
  const now = Date.now();
  store.activateBoost("alice", "boost", now);
  store.activateBoost("bob", "superboost", now);
  assert.ok(store.getBoostLevel("bob", now) > store.getBoostLevel("alice", now));
  assert.ok(store.getBoostLevel("alice", now) > store.getBoostLevel("carol", now));
});
