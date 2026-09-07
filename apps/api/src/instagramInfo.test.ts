import { test } from "node:test";
import assert from "node:assert/strict";
import { InstagramInfoStore } from "./instagramInfo";

test("get() returns empty fields before any connection", () => {
  const store = new InstagramInfoStore();
  assert.deepEqual(store.get("alice"), { connected: false, posts: [], hideInstagram: false });
});

test("connect() marks the author connected and stores posts", () => {
  const store = new InstagramInfoStore();
  const result = store.connect("alice", ["https://instagram.com/p/1", "https://instagram.com/p/2"]);
  assert.deepEqual(result, {
    connected: true,
    posts: ["https://instagram.com/p/1", "https://instagram.com/p/2"],
    hideInstagram: false,
  });
});

test("disconnect() clears posts and marks the author disconnected", () => {
  const store = new InstagramInfoStore();
  store.connect("alice", ["https://instagram.com/p/1"]);
  const result = store.disconnect("alice");
  assert.deepEqual(result, { connected: false, posts: [], hideInstagram: false });
});

test("disconnect() preserves an existing hideInstagram preference", () => {
  const store = new InstagramInfoStore();
  store.connect("alice", ["https://instagram.com/p/1"]);
  store.setHideInstagram("alice", true);
  const result = store.disconnect("alice");
  assert.deepEqual(result, { connected: false, posts: [], hideInstagram: true });
});

test("setHideInstagram() updates the hide flag without touching connection state", () => {
  const store = new InstagramInfoStore();
  store.connect("alice", ["https://instagram.com/p/1"]);
  const result = store.setHideInstagram("alice", true);
  assert.deepEqual(result, { connected: true, posts: ["https://instagram.com/p/1"], hideInstagram: true });
});

test("reconnecting replaces the previous posts", () => {
  const store = new InstagramInfoStore();
  store.connect("alice", ["https://instagram.com/p/1"]);
  const result = store.connect("alice", ["https://instagram.com/p/2", "https://instagram.com/p/3"]);
  assert.deepEqual(result, {
    connected: true,
    posts: ["https://instagram.com/p/2", "https://instagram.com/p/3"],
    hideInstagram: false,
  });
});

test("each author's Instagram info is independent", () => {
  const store = new InstagramInfoStore();
  store.connect("alice", ["https://instagram.com/p/1"]);
  assert.deepEqual(store.get("bob"), { connected: false, posts: [], hideInstagram: false });
});
