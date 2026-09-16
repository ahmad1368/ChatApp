import { test } from "node:test";
import assert from "node:assert/strict";
import { GpsVerificationStore } from "./gpsVerificationRecord";

test("get() defaults to unverified for an untracked author", () => {
  const store = new GpsVerificationStore();
  assert.deepEqual(store.get("alice"), { verified: false, distanceKm: null, verifiedAt: null });
});

test("record() stores the verification result", () => {
  const store = new GpsVerificationStore();
  const result = store.record("alice", true, 5);
  assert.equal(result.verified, true);
  assert.equal(result.distanceKm, 5);
  assert.ok(result.verifiedAt);
});

test("hasVerifiedBadge() is false before any check and false for a failed check", () => {
  const store = new GpsVerificationStore();
  assert.equal(store.hasVerifiedBadge("alice"), false);
  store.record("alice", false, 500);
  assert.equal(store.hasVerifiedBadge("alice"), false);
});

test("hasVerifiedBadge() is true once verified", () => {
  const store = new GpsVerificationStore();
  store.record("alice", true, 2);
  assert.equal(store.hasVerifiedBadge("alice"), true);
});

test("each author's record is independent", () => {
  const store = new GpsVerificationStore();
  store.record("alice", true, 2);
  assert.equal(store.get("bob").verified, false);
});
