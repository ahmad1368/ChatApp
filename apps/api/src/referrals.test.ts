import test from "node:test";
import assert from "node:assert/strict";
import { ReferralStore } from "./referrals";

test("getOrCreateCode() returns undefined for a missing author", () => {
  const store = new ReferralStore();
  assert.equal(store.getOrCreateCode(""), undefined);
});

test("getOrCreateCode() returns the same code on repeated calls for the same author", () => {
  const store = new ReferralStore();
  const first = store.getOrCreateCode("alice");
  const second = store.getOrCreateCode("alice");
  assert.equal(first, second);
});

test("getOrCreateCode() returns different codes for different authors", () => {
  const store = new ReferralStore();
  const alice = store.getOrCreateCode("alice");
  const bob = store.getOrCreateCode("bob");
  assert.notEqual(alice, bob);
});

test("redeem() rejects a missing referee, unknown code, or self-redemption", () => {
  const store = new ReferralStore();
  const code = store.getOrCreateCode("alice");
  assert.equal(store.redeem(code, "").success, false);
  assert.equal(store.redeem("NOTREAL", "bob").success, false);
  assert.equal(store.redeem(code, "alice").success, false);
});

test("redeem() succeeds and returns the referrer", () => {
  const store = new ReferralStore();
  const code = store.getOrCreateCode("alice");
  const result = store.redeem(code, "bob");
  assert.equal(result.success, true);
  assert.equal(result.success && result.referrer, "alice");
});

test("redeem() is case-insensitive on the code", () => {
  const store = new ReferralStore();
  const code = store.getOrCreateCode("alice");
  const result = store.redeem(code?.toLowerCase(), "bob");
  assert.equal(result.success, true);
});

test("redeem() rejects a referee who has already redeemed a (possibly different) code", () => {
  const store = new ReferralStore();
  const aliceCode = store.getOrCreateCode("alice");
  const carolCode = store.getOrCreateCode("carol");
  store.redeem(aliceCode, "bob");
  const result = store.redeem(carolCode, "bob");
  assert.equal(result.success, false);
});

test("getReferralCount() reflects successful redemptions for that referrer only", () => {
  const store = new ReferralStore();
  const aliceCode = store.getOrCreateCode("alice");
  store.getOrCreateCode("carol");
  store.redeem(aliceCode, "bob");
  store.redeem(aliceCode, "dave");
  assert.equal(store.getReferralCount("alice"), 2);
  assert.equal(store.getReferralCount("carol"), 0);
});
