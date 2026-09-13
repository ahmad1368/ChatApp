import test from "node:test";
import assert from "node:assert/strict";
import { CoinStore } from "./coins";

test("getBalance() is 0 for an author who has never purchased anything", () => {
  const store = new CoinStore();
  assert.equal(store.getBalance("alice"), 0);
});

test("purchase() rejects a missing author or unknown package id", () => {
  const store = new CoinStore();
  assert.equal(store.purchase("", "small").success, false);
  assert.equal(store.purchase("alice", "jumbo").success, false);
});

test("purchase() credits the balance by the package's coin amount", () => {
  const store = new CoinStore();
  const result = store.purchase("alice", "small");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.balance, 100);
  assert.equal(store.getBalance("alice"), 100);
});

test("purchase() accumulates across multiple purchases", () => {
  const store = new CoinStore();
  store.purchase("alice", "small");
  const second = store.purchase("alice", "medium");
  assert.equal(second.success, true);
  if (!second.success) return;
  assert.equal(second.balance, 650);
});

test("spend() rejects a missing author, non-positive amount, or insufficient balance", () => {
  const store = new CoinStore();
  store.purchase("alice", "small");
  assert.equal(store.spend("", 10).success, false);
  assert.equal(store.spend("alice", 0).success, false);
  assert.equal(store.spend("alice", -5).success, false);
  assert.equal(store.spend("alice", 1.5).success, false);
  assert.equal(store.spend("alice", 101).success, false);
});

test("spend() debits the balance when sufficient", () => {
  const store = new CoinStore();
  store.purchase("alice", "small");
  const result = store.spend("alice", 40);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.balance, 60);
  assert.equal(store.getBalance("alice"), 60);
});

test("each author's balance is independent", () => {
  const store = new CoinStore();
  store.purchase("alice", "small");
  assert.equal(store.getBalance("bob"), 0);
});
