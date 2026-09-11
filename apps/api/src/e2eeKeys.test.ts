import { test } from "node:test";
import assert from "node:assert/strict";
import { PublicKeyStore } from "./e2eeKeys";

test("publish() rejects a missing author", () => {
  const store = new PublicKeyStore();
  const result = store.publish("", { kty: "EC" });
  assert.equal(result.success, false);
});

test("publish() rejects a missing publicKeyJwk", () => {
  const store = new PublicKeyStore();
  const result = store.publish("alice", undefined);
  assert.equal(result.success, false);
});

test("publish() rejects a non-object publicKeyJwk", () => {
  const store = new PublicKeyStore();
  const result = store.publish("alice", "not-a-key");
  assert.equal(result.success, false);
});

test("publish() then get() returns the published key", () => {
  const store = new PublicKeyStore();
  const key = { kty: "EC", crv: "P-256", x: "abc", y: "def" };
  store.publish("alice", key);
  assert.deepEqual(store.get("alice"), key);
});

test("get() returns undefined for an author with no published key", () => {
  const store = new PublicKeyStore();
  assert.equal(store.get("alice"), undefined);
});

test("each author's published key is independent", () => {
  const store = new PublicKeyStore();
  store.publish("alice", { x: "alice-key" });
  store.publish("bob", { x: "bob-key" });
  assert.deepEqual(store.get("alice"), { x: "alice-key" });
  assert.deepEqual(store.get("bob"), { x: "bob-key" });
});

test("publishing again overwrites the previous key for that author", () => {
  const store = new PublicKeyStore();
  store.publish("alice", { x: "old" });
  store.publish("alice", { x: "new" });
  assert.deepEqual(store.get("alice"), { x: "new" });
});
