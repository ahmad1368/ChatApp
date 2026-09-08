import { test } from "node:test";
import assert from "node:assert/strict";
import { ArchivedChatsStore } from "./archivedChats";

test("archive() adds a chat to the viewer's archived list", () => {
  const store = new ArchivedChatsStore();
  const result = store.archive("alice", "bob");
  assert.equal(result.success, true);
  assert.deepEqual(store.getArchivedChats("alice"), ["bob"]);
});

test("archive() rejects missing viewerAuthor or chatAuthor", () => {
  const store = new ArchivedChatsStore();
  assert.equal(store.archive("", "bob").success, false);
  assert.equal(store.archive("alice", "").success, false);
});

test("archive() rejects archiving yourself", () => {
  const store = new ArchivedChatsStore();
  const result = store.archive("alice", "alice");
  assert.equal(result.success, false);
});

test("archive() is idempotent", () => {
  const store = new ArchivedChatsStore();
  store.archive("alice", "bob");
  store.archive("alice", "bob");
  assert.deepEqual(store.getArchivedChats("alice"), ["bob"]);
});

test("archive() is one-sided — archiving from alice's side doesn't archive for bob", () => {
  const store = new ArchivedChatsStore();
  store.archive("alice", "bob");
  assert.equal(store.isArchived("alice", "bob"), true);
  assert.equal(store.isArchived("bob", "alice"), false);
});

test("unarchive() removes a chat from the viewer's archived list", () => {
  const store = new ArchivedChatsStore();
  store.archive("alice", "bob");
  const result = store.unarchive("alice", "bob");
  assert.equal(result.success, true);
  assert.deepEqual(store.getArchivedChats("alice"), []);
});

test("unarchive() is a no-op for a chat that was never archived", () => {
  const store = new ArchivedChatsStore();
  const result = store.unarchive("alice", "bob");
  assert.equal(result.success, true);
  assert.deepEqual(store.getArchivedChats("alice"), []);
});

test("isArchived() is false for an untracked viewer", () => {
  const store = new ArchivedChatsStore();
  assert.equal(store.isArchived("alice", "bob"), false);
});

test("getArchivedChats() supports multiple archived chats for the same viewer", () => {
  const store = new ArchivedChatsStore();
  store.archive("alice", "bob");
  store.archive("alice", "carol");
  assert.deepEqual(new Set(store.getArchivedChats("alice")), new Set(["bob", "carol"]));
});
