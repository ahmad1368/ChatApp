import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileBoostStore, BOOST_DURATION_MS, BOOST_PACKAGES, findBoostPackage } from "./profileBoost";

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

test("findBoostPackage() resolves a known package id and returns undefined for an unknown one", () => {
  assert.equal(findBoostPackage("single")?.boosts, 1);
  assert.equal(findBoostPackage("does-not-exist"), undefined);
});

test("getCredits() is 0 before any package is granted", () => {
  const store = new ProfileBoostStore();
  assert.equal(store.getCredits("alice"), 0);
});

test("grantCredits() accumulates across multiple grants", () => {
  const store = new ProfileBoostStore();
  store.grantCredits("alice", BOOST_PACKAGES[0].boosts);
  const total = store.grantCredits("alice", BOOST_PACKAGES[1].boosts);
  assert.equal(total, BOOST_PACKAGES[0].boosts + BOOST_PACKAGES[1].boosts);
});

test("activateBoostWithCredit() rejects a missing author or a zero credit balance", () => {
  const store = new ProfileBoostStore();
  assert.equal(store.activateBoostWithCredit("", "boost").success, false);
  assert.equal(store.activateBoostWithCredit("alice", "boost").success, false);
});

test("activateBoostWithCredit() consumes exactly one credit per successful activation", () => {
  const store = new ProfileBoostStore();
  store.grantCredits("alice", 2);

  const first = store.activateBoostWithCredit("alice", "boost");
  assert.equal(first.success, true);
  assert.equal(store.getCredits("alice"), 1);

  const second = store.activateBoostWithCredit("alice", "superboost");
  assert.equal(second.success, true);
  assert.equal(store.getCredits("alice"), 0);

  const third = store.activateBoostWithCredit("alice", "boost");
  assert.equal(third.success, false);
});

test("activateBoostWithCredit() actually activates the boost, same as the free path", () => {
  const store = new ProfileBoostStore();
  store.grantCredits("alice", 1);
  store.activateBoostWithCredit("alice", "superboost");
  assert.equal(store.isBoosted("alice"), true);
  assert.equal(store.getStatus("alice").tier, "superboost");
});
