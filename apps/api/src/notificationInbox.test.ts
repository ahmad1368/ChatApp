import { test } from "node:test";
import assert from "node:assert/strict";
import { NotificationInboxStore } from "./notificationInbox";

test("getInbox() is empty for an author with no recorded events", () => {
  const store = new NotificationInboxStore();
  assert.deepEqual(store.getInbox("alice"), []);
});

test("record() adds an unread entry retrievable via getInbox()", () => {
  const store = new NotificationInboxStore();
  store.record("alice", "newMatch", "New Match! 🎉", "You and bob have matched!");
  const inbox = store.getInbox("alice");
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].category, "newMatch");
  assert.equal(inbox[0].title, "New Match! 🎉");
  assert.equal(inbox[0].read, false);
});

test("record() puts the newest entry first", () => {
  const store = new NotificationInboxStore();
  store.record("alice", "newMatch", "First", "body");
  store.record("alice", "newLike", "Second", "body");
  const inbox = store.getInbox("alice");
  assert.equal(inbox[0].title, "Second");
  assert.equal(inbox[1].title, "First");
});

test("getUnreadCount() counts only unread entries", () => {
  const store = new NotificationInboxStore();
  store.record("alice", "newMatch", "a", "b");
  store.record("alice", "newLike", "c", "d");
  assert.equal(store.getUnreadCount("alice"), 2);

  const [firstId] = store.getInbox("alice").map((e) => e.id);
  store.markRead("alice", firstId);
  assert.equal(store.getUnreadCount("alice"), 1);
});

test("markRead() returns false for an unknown entry id", () => {
  const store = new NotificationInboxStore();
  assert.equal(store.markRead("alice", "nope"), false);
});

test("markAllRead() marks every entry for that author read", () => {
  const store = new NotificationInboxStore();
  store.record("alice", "newMatch", "a", "b");
  store.record("alice", "newLike", "c", "d");
  store.markAllRead("alice");
  assert.equal(store.getUnreadCount("alice"), 0);
  assert.ok(store.getInbox("alice").every((e) => e.read));
});

test("entries and unread counts are independent per author", () => {
  const store = new NotificationInboxStore();
  store.record("alice", "newMatch", "a", "b");
  assert.equal(store.getInbox("bob").length, 0);
  assert.equal(store.getUnreadCount("bob"), 0);
});

test("caps stored entries per author to avoid unbounded growth", () => {
  const store = new NotificationInboxStore();
  for (let i = 0; i < 250; i++) {
    store.record("alice", "newLike", `like ${i}`, "body");
  }
  assert.equal(store.getInbox("alice").length, 200);
  // Newest survive, oldest are dropped.
  assert.equal(store.getInbox("alice")[0].title, "like 249");
});
