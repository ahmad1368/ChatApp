import test from "node:test";
import assert from "node:assert/strict";
import { PaymentMethodStore } from "./paymentMethods";

test("add() rejects missing author, invalid type, missing brand, or a non-4-digit last4", () => {
  const store = new PaymentMethodStore();
  assert.equal(store.add("", "card", "Visa", "4242").success, false);
  assert.equal(store.add("alice", "crypto", "Visa", "4242").success, false);
  assert.equal(store.add("alice", "card", "", "4242").success, false);
  assert.equal(store.add("alice", "card", "Visa", "42").success, false);
  assert.equal(store.add("alice", "card", "Visa", "42424242").success, false);
  assert.equal(store.add("alice", "card", "Visa", "abcd").success, false);
});

test("add() never accepts anything but a masked last4 — there's no full-number field to smuggle one into", () => {
  const store = new PaymentMethodStore();
  const result = store.add("alice", "card", "Visa", "4242");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(Object.keys(result.method).sort(), ["addedAt", "author", "brand", "id", "isDefault", "last4", "type"]);
});

test("the first payment method added for an author becomes the default automatically", () => {
  const store = new PaymentMethodStore();
  const first = store.add("alice", "card", "Visa", "4242");
  const second = store.add("alice", "bank", "Chase", "1234");
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  if (!first.success || !second.success) return;
  assert.equal(first.method.isDefault, true);
  assert.equal(second.method.isDefault, false);
});

test("setDefault() switches which method is default and rejects an unknown id", () => {
  const store = new PaymentMethodStore();
  store.add("alice", "card", "Visa", "4242");
  const second = store.add("alice", "bank", "Chase", "1234");
  assert.equal(second.success, true);
  if (!second.success) return;

  assert.equal(store.setDefault("alice", second.method.id), true);
  const list = store.list("alice");
  assert.equal(list.find((m) => m.id === second.method.id)?.isDefault, true);
  assert.equal(list.find((m) => m.id !== second.method.id)?.isDefault, false);

  assert.equal(store.setDefault("alice", "does-not-exist"), false);
});

test("remove() deletes a method and promotes another to default if the default was removed", () => {
  const store = new PaymentMethodStore();
  const first = store.add("alice", "card", "Visa", "4242");
  const second = store.add("alice", "bank", "Chase", "1234");
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  if (!first.success || !second.success) return;

  assert.equal(store.remove("alice", first.method.id), true);
  const list = store.list("alice");
  assert.equal(list.length, 1);
  assert.equal(list[0].id, second.method.id);
  assert.equal(list[0].isDefault, true);
});

test("remove() returns false for an unknown author or method id", () => {
  const store = new PaymentMethodStore();
  assert.equal(store.remove("alice", "does-not-exist"), false);
  store.add("alice", "card", "Visa", "4242");
  assert.equal(store.remove("alice", "does-not-exist"), false);
});

test("list() returns an empty array for an author with no saved methods", () => {
  const store = new PaymentMethodStore();
  assert.deepEqual(store.list("alice"), []);
});
