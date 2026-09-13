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
