import { test } from "node:test";
import assert from "node:assert/strict";
import { CafeGiftCardStore, findDenomination } from "./cafeGiftCard";

test("findDenomination() finds a valid catalog amount", () => {
  const denom = findDenomination(10);
  assert.deepEqual(denom, { amountDollars: 10, coinCost: 1000 });
});

test("findDenomination() returns undefined for an amount not in the catalog", () => {
  assert.equal(findDenomination(7), undefined);
});

test("create() rejects a missing sender or recipient", () => {
  const store = new CafeGiftCardStore();
  assert.equal(store.create("", "bob", 5).success, false);
  assert.equal(store.create("alice", "", 5).success, false);
});

test("create() rejects sending a gift card to yourself", () => {
  const store = new CafeGiftCardStore();
  const result = store.create("alice", "alice", 5);
  assert.equal(result.success, false);
});

test("create() rejects an amount not in the catalog", () => {
  const store = new CafeGiftCardStore();
  const result = store.create("alice", "bob", 7);
  assert.equal(result.success, false);
});

test("create() succeeds with a valid amount and generates a real code", () => {
  const store = new CafeGiftCardStore();
  const result = store.create("alice", "bob", 10);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.card.amountDollars, 10);
  assert.equal(result.card.sender, "alice");
  assert.equal(result.card.recipient, "bob");
  assert.equal(result.card.redeemed, false);
  assert.match(result.card.code, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
});

test("create() generates a distinct code each time", () => {
  const store = new CafeGiftCardStore();
  const first = store.create("alice", "bob", 5);
  const second = store.create("alice", "bob", 5);
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  if (!first.success || !second.success) return;
  assert.notEqual(first.card.code, second.card.code);
  assert.notEqual(first.card.id, second.card.id);
});

test("redeem() rejects an unknown card id", () => {
  const store = new CafeGiftCardStore();
  const result = store.redeem("not-a-real-id", "bob");
  assert.equal(result.success, false);
});

test("redeem() rejects a redeemer who isn't the recipient", () => {
  const store = new CafeGiftCardStore();
  const created = store.create("alice", "bob", 5);
  assert.equal(created.success, true);
  if (!created.success) return;
  const result = store.redeem(created.card.id, "mallory");
  assert.equal(result.success, false);
});

test("redeem() succeeds for the recipient and marks the card redeemed", () => {
  const store = new CafeGiftCardStore();
  const created = store.create("alice", "bob", 5);
  assert.equal(created.success, true);
  if (!created.success) return;
  const result = store.redeem(created.card.id, "bob");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.card.redeemed, true);
});

test("redeem() rejects redeeming the same card twice", () => {
  const store = new CafeGiftCardStore();
  const created = store.create("alice", "bob", 5);
  assert.equal(created.success, true);
  if (!created.success) return;
  store.redeem(created.card.id, "bob");
  const result = store.redeem(created.card.id, "bob");
  assert.equal(result.success, false);
});

test("get() returns the stored card", () => {
  const store = new CafeGiftCardStore();
  const created = store.create("alice", "bob", 5);
  assert.equal(created.success, true);
  if (!created.success) return;
  assert.deepEqual(store.get(created.card.id), created.card);
});

test("get() returns undefined for an unknown id", () => {
  const store = new CafeGiftCardStore();
  assert.equal(store.get("not-a-real-id"), undefined);
});
