import test from "node:test";
import assert from "node:assert/strict";
import { SubscriptionStore, findGiftPackage } from "./subscriptions";

test("subscribe() rejects a missing author or invalid tier", () => {
  const store = new SubscriptionStore();
  assert.equal(store.subscribe("", "gold").success, false);
  assert.equal(store.subscribe("alice", "diamond").success, false);
});

test("subscribe() succeeds and getStatus() reflects it", () => {
  const store = new SubscriptionStore();
  const result = store.subscribe("alice", "gold");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.subscription.tier, "gold");
  assert.equal(store.getStatus("alice")?.tier, "gold");
});

test("subscribe() again with a different tier replaces the previous one", () => {
  const store = new SubscriptionStore();
  store.subscribe("alice", "gold");
  store.subscribe("alice", "vip");
  assert.equal(store.getStatus("alice")?.tier, "vip");
});

test("getStatus() returns undefined for a user who never subscribed", () => {
  const store = new SubscriptionStore();
  assert.equal(store.getStatus("alice"), undefined);
});

test("getStatus() returns undefined once a subscription with auto-renew off has expired, and it stops appearing in listActive()", () => {
  const store = new SubscriptionStore();
  const result = store.subscribe("alice", "platinum");
  assert.equal(result.success, true);
  if (!result.success) return;
  store.setAutoRenew("alice", false);
  // Force it into the past instead of waiting 30 real days.
  result.subscription.expiresAt = new Date(Date.now() - 1000).toISOString();

  assert.equal(store.getStatus("alice"), undefined);
  assert.deepEqual(store.listActive(), []);
});

test("cancel() removes an active subscription and returns whether one existed", () => {
  const store = new SubscriptionStore();
  store.subscribe("alice", "gold");
  assert.equal(store.cancel("alice"), true);
  assert.equal(store.getStatus("alice"), undefined);
  assert.equal(store.cancel("alice"), false);
});

test("listActive() returns every currently active subscriber", () => {
  const store = new SubscriptionStore();
  store.subscribe("alice", "gold");
  store.subscribe("bob", "vip");
  const authors = store.listActive().map((s) => s.author).sort();
  assert.deepEqual(authors, ["alice", "bob"]);
});

test("startTrial() rejects a missing author or invalid tier", () => {
  const store = new SubscriptionStore();
  assert.equal(store.startTrial("", "gold").success, false);
  assert.equal(store.startTrial("alice", "diamond").success, false);
});

test("startTrial() succeeds, marks isTrial, and getStatus() reflects it", () => {
  const store = new SubscriptionStore();
  const result = store.startTrial("alice", "platinum");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.subscription.isTrial, true);
  assert.equal(store.getStatus("alice")?.tier, "platinum");
  assert.equal(store.getStatus("alice")?.isTrial, true);
});

test("startTrial() marks the trial as used, even after it's cancelled", () => {
  const store = new SubscriptionStore();
  store.startTrial("alice", "gold");
  assert.equal(store.hasUsedTrial("alice"), true);
  store.cancel("alice");
  assert.equal(store.hasUsedTrial("alice"), true);
});

test("startTrial() rejects a second trial for the same author", () => {
  const store = new SubscriptionStore();
  store.startTrial("alice", "gold");
  store.cancel("alice");
  const result = store.startTrial("alice", "vip");
  assert.equal(result.success, false);
});

test("startTrial() rejects when the author already has an active subscription", () => {
  const store = new SubscriptionStore();
  store.subscribe("alice", "gold");
  const result = store.startTrial("alice", "vip");
  assert.equal(result.success, false);
});

test("a regular subscribe() is not marked as a trial", () => {
  const store = new SubscriptionStore();
  const result = store.subscribe("alice", "gold");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.subscription.isTrial, false);
});

test("hasUsedTrial() is false before any trial is started", () => {
  const store = new SubscriptionStore();
  assert.equal(store.hasUsedTrial("alice"), false);
});

test("grantDays() rejects a missing author or invalid tier", () => {
  const store = new SubscriptionStore();
  assert.equal(store.grantDays("", "gold", 7).success, false);
  assert.equal(store.grantDays("alice", "diamond", 7).success, false);
});

test("grantDays() grants a subscription for the exact custom duration given", () => {
  const store = new SubscriptionStore();
  const before = Date.now();
  const result = store.grantDays("alice", "vip", 7);
  assert.equal(result.success, true);
  if (!result.success) return;
  const expiresAt = new Date(result.subscription.expiresAt).getTime();
  const expected = before + 7 * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(expiresAt - expected) < 5000);
  assert.equal(result.subscription.isTrial, false);
  assert.equal(store.getStatus("alice")?.tier, "vip");
});

test("extendOrGrant() grants a fresh subscription at the given tier when none is active", () => {
  const store = new SubscriptionStore();
  const result = store.extendOrGrant("alice", "gold", 7);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.subscription.tier, "gold");
  assert.equal(store.getStatus("alice")?.tier, "gold");
});

test("extendOrGrant() extends an existing active subscription's expiry, keeping its current tier", () => {
  const store = new SubscriptionStore();
  const original = store.subscribe("alice", "platinum");
  assert.equal(original.success, true);
  if (!original.success) return;
  const originalExpiresAt = new Date(original.subscription.expiresAt).getTime();

  const result = store.extendOrGrant("alice", "gold", 7);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.subscription.tier, "platinum");
  const newExpiresAt = new Date(result.subscription.expiresAt).getTime();
  assert.equal(newExpiresAt - originalExpiresAt, 7 * 24 * 60 * 60 * 1000);
});

test("extendOrGrant() rejects a missing author or invalid tier", () => {
  const store = new SubscriptionStore();
  assert.equal(store.extendOrGrant("", "gold", 7).success, false);
  assert.equal(store.extendOrGrant("alice", "diamond", 7).success, false);
});

test("subscribe() defaults to autoRenew: true", () => {
  const store = new SubscriptionStore();
  const result = store.subscribe("alice", "gold");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.subscription.autoRenew, true);
});

test("startTrial(), grantDays(), and a fresh extendOrGrant() default to autoRenew: false", () => {
  const store = new SubscriptionStore();
  const trial = store.startTrial("alice", "gold");
  assert.equal(trial.success, true);
  if (trial.success) assert.equal(trial.subscription.autoRenew, false);

  const granted = store.grantDays("bob", "gold", 7);
  assert.equal(granted.success, true);
  if (granted.success) assert.equal(granted.subscription.autoRenew, false);

  const extended = store.extendOrGrant("carol", "gold", 7);
  assert.equal(extended.success, true);
  if (extended.success) assert.equal(extended.subscription.autoRenew, false);
});

test("getStatus() auto-renews an expired subscription with autoRenew on, for another full period at the same tier", () => {
  const store = new SubscriptionStore();
  const result = store.subscribe("alice", "platinum");
  assert.equal(result.success, true);
  if (!result.success) return;
  const originalExpiresAt = new Date(result.subscription.expiresAt).getTime();
  // Force it just past expiry instead of waiting 30 real days.
  result.subscription.expiresAt = new Date(Date.now() - 1000).toISOString();

  const renewed = store.getStatus("alice");
  assert.ok(renewed);
  assert.equal(renewed?.tier, "platinum");
  assert.equal(renewed?.autoRenew, true);
  assert.ok(new Date(renewed!.expiresAt).getTime() > Date.now());
  // Still one real 30-day period long, just anchored to the missed
  // expiry rather than "now" — no schedule drift.
  assert.notEqual(new Date(renewed!.expiresAt).getTime(), originalExpiresAt);
});

test("getStatus() rolls forward through every period missed, not just one, for a long-unchecked auto-renewing subscription", () => {
  const store = new SubscriptionStore();
  const result = store.subscribe("alice", "gold");
  assert.equal(result.success, true);
  if (!result.success) return;
  // Simulate 3 missed periods (~95 days) without ever calling getStatus().
  result.subscription.expiresAt = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();

  const renewed = store.getStatus("alice");
  assert.ok(renewed);
  assert.ok(new Date(renewed!.expiresAt).getTime() > Date.now());
});

test("setAutoRenew() turns renewal off, so the subscription lapses at its current expiry instead of renewing", () => {
  const store = new SubscriptionStore();
  const result = store.subscribe("alice", "gold");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(store.setAutoRenew("alice", false), true);
  result.subscription.expiresAt = new Date(Date.now() - 1000).toISOString();

  assert.equal(store.getStatus("alice"), undefined);
});

test("setAutoRenew() turns renewal back on for a subscription created without it", () => {
  const store = new SubscriptionStore();
  const result = store.startTrial("alice", "gold");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(store.setAutoRenew("alice", true), true);
  result.subscription.expiresAt = new Date(Date.now() - 1000).toISOString();

  assert.ok(store.getStatus("alice"));
});

test("setAutoRenew() returns false when there's no active subscription to change", () => {
  const store = new SubscriptionStore();
  assert.equal(store.setAutoRenew("alice", true), false);
});

test("cancelAtPeriodEnd() rejects when there's no active subscription", () => {
  const store = new SubscriptionStore();
  const result = store.cancelAtPeriodEnd("alice");
  assert.equal(result.success, false);
});

test("cancelAtPeriodEnd() turns off auto-renew but keeps access until the real expiresAt", () => {
  const store = new SubscriptionStore();
  const subscribed = store.subscribe("alice", "gold");
  assert.equal(subscribed.success, true);
  if (!subscribed.success) return;

  const result = store.cancelAtPeriodEnd("alice");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.expiresAt, subscribed.subscription.expiresAt);

  const status = store.getStatus("alice");
  assert.ok(status, "access is retained immediately after cancelling");
  assert.equal(status?.autoRenew, false);
});

test("cancelAtPeriodEnd() actually stops the next renewal once the period ends", () => {
  const store = new SubscriptionStore();
  const subscribed = store.subscribe("alice", "gold");
  assert.equal(subscribed.success, true);
  if (!subscribed.success) return;
  store.cancelAtPeriodEnd("alice");
  subscribed.subscription.expiresAt = new Date(Date.now() - 1000).toISOString();

  assert.equal(store.getStatus("alice"), undefined);
});

test("cancelAtPeriodEnd() can be undone by turning auto-renew back on before the period ends", () => {
  const store = new SubscriptionStore();
  const subscribed = store.subscribe("alice", "gold");
  assert.equal(subscribed.success, true);
  if (!subscribed.success) return;
  store.cancelAtPeriodEnd("alice");
  store.setAutoRenew("alice", true);
  subscribed.subscription.expiresAt = new Date(Date.now() - 1000).toISOString();

  assert.ok(store.getStatus("alice"));
});

test("findGiftPackage() resolves a known package id and returns undefined for an unknown one", () => {
  assert.equal(findGiftPackage("gold-7")?.tier, "gold");
  assert.equal(findGiftPackage("does-not-exist"), undefined);
});
