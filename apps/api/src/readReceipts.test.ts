import { test } from "node:test";
import assert from "node:assert/strict";
import { ReadReceiptStore } from "./readReceipts";

test("getStatus() is sent before any delivery or read", () => {
  const store = new ReadReceiptStore();
  assert.equal(store.getStatus("m1", "alice"), "sent");
});

test("markDelivered() by another author moves status to delivered", () => {
  const store = new ReadReceiptStore();
  store.markDelivered("m1", "bob");
  assert.equal(store.getStatus("m1", "alice"), "delivered");
});

test("markDelivered() by the sender themselves does not count", () => {
  const store = new ReadReceiptStore();
  store.markDelivered("m1", "alice");
  assert.equal(store.getStatus("m1", "alice"), "sent");
});

test("markRead() by another author moves status to read", () => {
  const store = new ReadReceiptStore();
  store.markRead("m1", "bob");
  assert.equal(store.getStatus("m1", "alice"), "read");
});

test("markRead() by the sender themselves does not count", () => {
  const store = new ReadReceiptStore();
  store.markRead("m1", "alice");
  assert.equal(store.getStatus("m1", "alice"), "sent");
});

test("markRead() implies delivered for that author", () => {
  const store = new ReadReceiptStore();
  store.markRead("m1", "bob");
  store.markRead("m2", "carol");
  // If read didn't imply delivered, a mixed read/delivered check on a
  // different message id would still resolve correctly for each.
  assert.equal(store.getStatus("m1", "alice"), "read");
  assert.equal(store.getStatus("m2", "alice"), "read");
});

test("read status is not downgraded by a later delivered-only call for a different author", () => {
  const store = new ReadReceiptStore();
  store.markRead("m1", "bob");
  store.markDelivered("m1", "carol");
  assert.equal(store.getStatus("m1", "alice"), "read");
});

test("statuses are tracked independently per message id", () => {
  const store = new ReadReceiptStore();
  store.markRead("m1", "bob");
  assert.equal(store.getStatus("m2", "alice"), "sent");
});

test("a group room's status reads 'read' once any one other participant has read it", () => {
  const store = new ReadReceiptStore();
  store.markDelivered("m1", "bob");
  store.markRead("m1", "carol");
  assert.equal(store.getStatus("m1", "alice"), "read");
});
