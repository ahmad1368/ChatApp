import { test } from "node:test";
import assert from "node:assert/strict";
import { FacebookConnectStore } from "./facebookConnect";

test("get() returns disconnected default before any connect", () => {
  const store = new FacebookConnectStore();
  assert.deepEqual(store.get("alice"), { connected: false, friendIds: [], hideFacebookFriends: false });
});

test("connect() stores the friend list and marks connected", () => {
  const store = new FacebookConnectStore();
  const info = store.connect("alice", ["fb-1", "fb-2"]);
  assert.equal(info.connected, true);
  assert.deepEqual(info.friendIds, ["fb-1", "fb-2"]);
  assert.deepEqual(store.get("alice"), info);
});

test("reconnecting replaces the previous friend list", () => {
  const store = new FacebookConnectStore();
  store.connect("alice", ["fb-1"]);
  store.connect("alice", ["fb-2", "fb-3"]);
  assert.deepEqual(store.get("alice").friendIds, ["fb-2", "fb-3"]);
});

test("disconnect() clears the friend list but preserves hideFacebookFriends", () => {
  const store = new FacebookConnectStore();
  store.connect("alice", ["fb-1"]);
  store.setHideFacebookFriends("alice", true);
  const info = store.disconnect("alice");
  assert.equal(info.connected, false);
  assert.deepEqual(info.friendIds, []);
  assert.equal(info.hideFacebookFriends, true);
});

test("getMutualFriendCount() counts shared friend ids between two connected authors", () => {
  const store = new FacebookConnectStore();
  store.connect("alice", ["fb-1", "fb-2", "fb-3"]);
  store.connect("bob", ["fb-2", "fb-3", "fb-4"]);
  assert.equal(store.getMutualFriendCount("alice", "bob"), 2);
});

test("getMutualFriendCount() is 0 if either author isn't connected", () => {
  const store = new FacebookConnectStore();
  store.connect("alice", ["fb-1"]);
  assert.equal(store.getMutualFriendCount("alice", "bob"), 0);
});

test("getMutualFriendCount() is 0 if either author hid their Facebook friends", () => {
  const store = new FacebookConnectStore();
  store.connect("alice", ["fb-1"]);
  store.connect("bob", ["fb-1"]);
  store.setHideFacebookFriends("bob", true);
  assert.equal(store.getMutualFriendCount("alice", "bob"), 0);
});

test("each author's Facebook connection is independent", () => {
  const store = new FacebookConnectStore();
  store.connect("alice", ["fb-1"]);
  assert.deepEqual(store.get("bob"), { connected: false, friendIds: [], hideFacebookFriends: false });
});
