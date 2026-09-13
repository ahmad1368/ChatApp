import test from "node:test";
import assert from "node:assert/strict";
import { TransactionLogStore } from "./transactionLog";

test("logPurchase() rejects missing author, non-positive amount, or missing description", () => {
  const store = new TransactionLogStore();
  assert.equal(store.logPurchase("", 500, "Gold plan").success, false);
  assert.equal(store.logPurchase("alice", 0, "Gold plan").success, false);
  assert.equal(store.logPurchase("alice", -100, "Gold plan").success, false);
  assert.equal(store.logPurchase("alice", 1.5, "Gold plan").success, false);
  assert.equal(store.logPurchase("alice", 500, "").success, false);
});

test("logPurchase() succeeds and appears in list()", () => {
  const store = new TransactionLogStore();
  const result = store.logPurchase("alice", 999, "Gold plan (monthly)");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.transaction.type, "purchase");
  assert.equal(result.transaction.amountCents, 999);
  assert.deepEqual(store.list().map((t) => t.id), [result.transaction.id]);
});

test("refund() rejects an unknown transaction id", () => {
  const store = new TransactionLogStore();
  const result = store.refund("does-not-exist", "customer request");
  assert.equal(result.success, false);
});

test("refund() rejects refunding a refund entry", () => {
  const store = new TransactionLogStore();
  const purchase = store.logPurchase("alice", 500, "Gold plan");
  assert.equal(purchase.success, true);
  if (!purchase.success) return;
  const firstRefund = store.refund(purchase.transaction.id, "duplicate charge");
  assert.equal(firstRefund.success, true);
  if (!firstRefund.success) return;
  const secondRefund = store.refund(firstRefund.refund.id, "trying to refund a refund");
  assert.equal(secondRefund.success, false);
});

test("refund() rejects refunding the same purchase twice", () => {
  const store = new TransactionLogStore();
  const purchase = store.logPurchase("alice", 500, "Gold plan");
  assert.equal(purchase.success, true);
  if (!purchase.success) return;
  assert.equal(store.refund(purchase.transaction.id, "customer request").success, true);
  assert.equal(store.refund(purchase.transaction.id, "customer request again").success, false);
});

test("refund() rejects a missing reason", () => {
  const store = new TransactionLogStore();
  const purchase = store.logPurchase("alice", 500, "Gold plan");
  assert.equal(purchase.success, true);
  if (!purchase.success) return;
  assert.equal(store.refund(purchase.transaction.id, "").success, false);
});

test("refund() marks the original purchase and logs a linked negative-amount refund entry", () => {
  const store = new TransactionLogStore();
  const purchase = store.logPurchase("alice", 500, "Gold plan");
  assert.equal(purchase.success, true);
  if (!purchase.success) return;

  const refund = store.refund(purchase.transaction.id, "customer request");
  assert.equal(refund.success, true);
  if (!refund.success) return;
  assert.equal(refund.refund.type, "refund");
  assert.equal(refund.refund.amountCents, -500);
  assert.equal(refund.refund.relatedTransactionId, purchase.transaction.id);

  const updatedOriginal = store.get(purchase.transaction.id);
  assert.equal(updatedOriginal?.refundedAt !== undefined, true);
  assert.equal(updatedOriginal?.refundReason, "customer request");
});

test("list() filters by author and type", () => {
  const store = new TransactionLogStore();
  store.logPurchase("alice", 500, "Gold plan");
  const bobPurchase = store.logPurchase("bob", 1000, "Platinum plan");
  assert.equal(bobPurchase.success, true);
  if (!bobPurchase.success) return;
  store.refund(bobPurchase.transaction.id, "customer request");

  assert.equal(store.list({ author: "alice" }).length, 1);
  assert.equal(store.list({ author: "bob" }).length, 2);
  assert.equal(store.list({ type: "refund" }).length, 1);
  assert.equal(store.list({ type: "purchase" }).length, 2);
});
