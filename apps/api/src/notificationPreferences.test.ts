import { test } from "node:test";
import assert from "node:assert/strict";
import { NotificationPreferencesStore, NOTIFICATION_CATEGORIES } from "./notificationPreferences";

test("get() returns every category enabled by default", () => {
  const store = new NotificationPreferencesStore();
  const preferences = store.get("alice");
  for (const category of NOTIFICATION_CATEGORIES) {
    assert.equal(preferences[category], true);
  }
});

test("isEnabled() is true by default for every category", () => {
  const store = new NotificationPreferencesStore();
  for (const category of NOTIFICATION_CATEGORIES) {
    assert.equal(store.isEnabled("alice", category), true);
  }
});

test("update() rejects a missing author", () => {
  const store = new NotificationPreferencesStore();
  const result = store.update("", { newMessage: false });
  assert.equal(result.success, false);
});

test("update() rejects an unknown category", () => {
  const store = new NotificationPreferencesStore();
  const result = store.update("alice", { carrierPigeon: false });
  assert.equal(result.success, false);
});

test("update() rejects a non-boolean value", () => {
  const store = new NotificationPreferencesStore();
  const result = store.update("alice", { newMessage: "off" });
  assert.equal(result.success, false);
});

test("update() turns off one category and leaves the rest enabled", () => {
  const store = new NotificationPreferencesStore();
  store.update("alice", { newMatch: false });
  assert.equal(store.isEnabled("alice", "newMatch"), false);
  assert.equal(store.isEnabled("alice", "newMessage"), true);
});

test("update() persists across multiple calls, merging rather than replacing", () => {
  const store = new NotificationPreferencesStore();
  store.update("alice", { newMatch: false });
  store.update("alice", { newLike: false });
  assert.equal(store.isEnabled("alice", "newMatch"), false);
  assert.equal(store.isEnabled("alice", "newLike"), false);
  assert.equal(store.isEnabled("alice", "newMessage"), true);
});

test("preferences are independent per author", () => {
  const store = new NotificationPreferencesStore();
  store.update("alice", { newMessage: false });
  assert.equal(store.isEnabled("alice", "newMessage"), false);
  assert.equal(store.isEnabled("bob", "newMessage"), true);
});
