import { test } from "node:test";
import assert from "node:assert/strict";
import { PresenceStore } from "./presence";

test("getStatus() reports offline with no last-active time before anything happens", () => {
  const store = new PresenceStore();
  assert.deepEqual(store.getStatus("alice"), { online: false, lastActiveAt: null });
});

test("markOnline() makes isOnline() true", () => {
  const store = new PresenceStore();
  store.markOnline("alice");
  assert.equal(store.isOnline("alice"), true);
});

test("markOnline() sets lastActiveAt", () => {
  const store = new PresenceStore();
  const now = Date.now();
  store.markOnline("alice", now);
  assert.equal(store.getStatus("alice").lastActiveAt, new Date(now).toISOString());
});

test("markOffline() makes isOnline() false after the only connection closes", () => {
  const store = new PresenceStore();
  store.markOnline("alice");
  store.markOffline("alice");
  assert.equal(store.isOnline("alice"), false);
});

test("markOffline() keeps isOnline() true while another connection for the same author remains open", () => {
  const store = new PresenceStore();
  store.markOnline("alice");
  store.markOnline("alice"); // second tab
  store.markOffline("alice"); // first tab closes
  assert.equal(store.isOnline("alice"), true);
  store.markOffline("alice"); // second tab closes
  assert.equal(store.isOnline("alice"), false);
});

test("markOffline() updates lastActiveAt to the moment they went offline", () => {
  const store = new PresenceStore();
  store.markOnline("alice", 1000);
  store.markOffline("alice", 2000);
  assert.equal(store.getStatus("alice").lastActiveAt, new Date(2000).toISOString());
});

test("recordActivity() updates lastActiveAt without changing online status", () => {
  const store = new PresenceStore();
  store.recordActivity("alice", 5000);
  const status = store.getStatus("alice");
  assert.equal(status.online, false);
  assert.equal(status.lastActiveAt, new Date(5000).toISOString());
});

test("presence is independent per author", () => {
  const store = new PresenceStore();
  store.markOnline("alice");
  assert.equal(store.isOnline("bob"), false);
});

test("markOffline() with no prior connection does not go negative or throw", () => {
  const store = new PresenceStore();
  store.markOffline("alice");
  assert.equal(store.isOnline("alice"), false);
});

test("getActiveWithinCount() (#179) counts only authors active within the window", () => {
  const store = new PresenceStore();
  const now = Date.now();
  store.recordActivity("alice", now - 1000);
  store.recordActivity("bob", now - 100_000);
  assert.equal(store.getActiveWithinCount(60_000, now), 1);
  assert.equal(store.getActiveWithinCount(200_000, now), 2);
});

test("getActiveWithinCount() is 0 when nobody has ever been active", () => {
  const store = new PresenceStore();
  assert.equal(store.getActiveWithinCount(60_000), 0);
});
