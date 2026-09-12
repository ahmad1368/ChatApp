import { test } from "node:test";
import assert from "node:assert/strict";
import { SnoozeAccountStore } from "./snoozeAccount";

test("isEnabled() is false before anything happens", () => {
  const store = new SnoozeAccountStore();
  assert.equal(store.isEnabled("alice"), false);
});

test("setEnabled() rejects a missing author", () => {
  const store = new SnoozeAccountStore();
  const result = store.setEnabled("", true);
  assert.deepEqual(result, { success: false, error: "author is required" });
});

test("setEnabled(author, true) snoozes the account", () => {
  const store = new SnoozeAccountStore();
  const result = store.setEnabled("alice", true);
  assert.deepEqual(result, { success: true, enabled: true });
  assert.equal(store.isEnabled("alice"), true);
});

test("setEnabled(author, false) un-snoozes the account", () => {
  const store = new SnoozeAccountStore();
  store.setEnabled("alice", true);
  const result = store.setEnabled("alice", false);
  assert.deepEqual(result, { success: true, enabled: false });
  assert.equal(store.isEnabled("alice"), false);
});

test("setEnabled() with a non-true value un-snoozes the account", () => {
  const store = new SnoozeAccountStore();
  store.setEnabled("alice", true);
  store.setEnabled("alice", "yes");
  assert.equal(store.isEnabled("alice"), false);
});

test("snooze is independent per author", () => {
  const store = new SnoozeAccountStore();
  store.setEnabled("alice", true);
  assert.equal(store.isEnabled("bob"), false);
});
