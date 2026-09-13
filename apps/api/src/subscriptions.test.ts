import test from "node:test";
import assert from "node:assert/strict";
import { SubscriptionStore } from "./subscriptions";

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

test("getStatus() returns undefined once a subscription has expired, and it stops appearing in listActive()", () => {
  const store = new SubscriptionStore();
  const result = store.subscribe("alice", "platinum");
  assert.equal(result.success, true);
  if (!result.success) return;
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
