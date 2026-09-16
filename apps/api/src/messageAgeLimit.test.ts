import { test } from "node:test";
import assert from "node:assert/strict";
import { MessageAgeLimitStore } from "./messageAgeLimit";

test("update rejects a missing author", () => {
  const store = new MessageAgeLimitStore();
  const result = store.update("", 25, 40);
  assert.equal(result.success, false);
});

test("update rejects a minAge below the valid range", () => {
  const store = new MessageAgeLimitStore();
  const result = store.update("alice", 10, 40);
  assert.equal(result.success, false);
});

test("update rejects a maxAge above the valid range", () => {
  const store = new MessageAgeLimitStore();
  const result = store.update("alice", 25, 150);
  assert.equal(result.success, false);
});

test("update rejects minAge greater than maxAge", () => {
  const store = new MessageAgeLimitStore();
  const result = store.update("alice", 40, 25);
  assert.equal(result.success, false);
});

test("update accepts a valid range", () => {
  const store = new MessageAgeLimitStore();
  const result = store.update("alice", 25, 40);
  assert.deepEqual(result, { success: true, limit: { minAge: 25, maxAge: 40 } });
});

test("update accepts only a minAge", () => {
  const store = new MessageAgeLimitStore();
  const result = store.update("alice", 25, null);
  assert.deepEqual(result, { success: true, limit: { minAge: 25, maxAge: null } });
});

test("update accepts only a maxAge", () => {
  const store = new MessageAgeLimitStore();
  const result = store.update("alice", null, 40);
  assert.deepEqual(result, { success: true, limit: { minAge: null, maxAge: 40 } });
});

test("get defaults to an unset limit", () => {
  const store = new MessageAgeLimitStore();
  assert.deepEqual(store.get("alice"), { minAge: null, maxAge: null });
});

test("the limit is tracked independently per author", () => {
  const store = new MessageAgeLimitStore();
  store.update("alice", 25, 40);
  assert.deepEqual(store.get("bob"), { minAge: null, maxAge: null });
});
