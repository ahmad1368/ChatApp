import { test } from "node:test";
import assert from "node:assert/strict";
import { PinnedChatsStore } from "./pinnedChats";

test("pin() adds a chat to the viewer's pinned list", () => {
  const store = new PinnedChatsStore();
  const result = store.pin("alice", "bob");
  assert.equal(result.success, true);
  assert.deepEqual(store.getPinnedChats("alice"), ["bob"]);
});

test("pin() rejects missing viewerAuthor or chatAuthor", () => {
  const store = new PinnedChatsStore();
  assert.equal(store.pin("", "bob").success, false);
  assert.equal(store.pin("alice", "").success, false);
});

test("pin() rejects pinning yourself", () => {
  const store = new PinnedChatsStore();
  const result = store.pin("alice", "alice");
  assert.equal(result.success, false);
});

test("pin() is idempotent", () => {
  const store = new PinnedChatsStore();
  store.pin("alice", "bob");
  store.pin("alice", "bob");
  assert.deepEqual(store.getPinnedChats("alice"), ["bob"]);
});

test("pin() is one-sided — pinning from alice's side doesn't pin for bob", () => {
  const store = new PinnedChatsStore();
  store.pin("alice", "bob");
  assert.equal(store.isPinned("alice", "bob"), true);
  assert.equal(store.isPinned("bob", "alice"), false);
});

test("unpin() removes a chat from the viewer's pinned list", () => {
  const store = new PinnedChatsStore();
  store.pin("alice", "bob");
  const result = store.unpin("alice", "bob");
  assert.equal(result.success, true);
  assert.deepEqual(store.getPinnedChats("alice"), []);
});

test("unpin() is a no-op for a chat that was never pinned", () => {
  const store = new PinnedChatsStore();
  const result = store.unpin("alice", "bob");
  assert.equal(result.success, true);
  assert.deepEqual(store.getPinnedChats("alice"), []);
});

test("isPinned() is false for an untracked viewer", () => {
  const store = new PinnedChatsStore();
  assert.equal(store.isPinned("alice", "bob"), false);
});

test("getPinnedChats() supports multiple pins for the same viewer", () => {
  const store = new PinnedChatsStore();
  store.pin("alice", "bob");
  store.pin("alice", "carol");
  assert.deepEqual(new Set(store.getPinnedChats("alice")), new Set(["bob", "carol"]));
});
