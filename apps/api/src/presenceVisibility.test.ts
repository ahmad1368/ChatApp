import { test } from "node:test";
import assert from "node:assert/strict";
import { PresenceVisibilityStore } from "./presenceVisibility";

const ONLINE_ACTIVE = { online: true, lastActiveAt: "2026-01-01T00:00:00.000Z" };

test("get() defaults to showing both online status and last active", () => {
  const store = new PresenceVisibilityStore();
  assert.deepEqual(store.get("alice"), { showOnlineStatus: true, showLastActive: true });
});

test("applyTo() passes the real status through unchanged by default", () => {
  const store = new PresenceVisibilityStore();
  assert.deepEqual(store.applyTo("alice", ONLINE_ACTIVE), ONLINE_ACTIVE);
});

test("update() rejects a missing author", () => {
  const store = new PresenceVisibilityStore();
  const result = store.update("", { showOnlineStatus: false });
  assert.equal(result.success, false);
});

test("update() rejects a non-boolean value", () => {
  const store = new PresenceVisibilityStore();
  const result = store.update("alice", { showOnlineStatus: "no" });
  assert.equal(result.success, false);
});

test("turning off showOnlineStatus always reports offline to viewers", () => {
  const store = new PresenceVisibilityStore();
  store.update("alice", { showOnlineStatus: false });
  const shown = store.applyTo("alice", ONLINE_ACTIVE);
  assert.equal(shown.online, false);
  // lastActiveAt is a separate toggle, untouched by this one.
  assert.equal(shown.lastActiveAt, ONLINE_ACTIVE.lastActiveAt);
});

test("turning off showLastActive nulls out lastActiveAt but not online", () => {
  const store = new PresenceVisibilityStore();
  store.update("alice", { showLastActive: false });
  const shown = store.applyTo("alice", ONLINE_ACTIVE);
  assert.equal(shown.online, true);
  assert.equal(shown.lastActiveAt, null);
});

test("a viewer who hid their own last-active also loses visibility into others' (mutual gating)", () => {
  const store = new PresenceVisibilityStore();
  store.update("bob", { showLastActive: false }); // bob (the viewer) hid his own
  const shown = store.applyTo("alice", ONLINE_ACTIVE, "bob");
  assert.equal(shown.lastActiveAt, null);
});

test("a viewer who never hid their own last-active still sees the author's", () => {
  const store = new PresenceVisibilityStore();
  const shown = store.applyTo("alice", ONLINE_ACTIVE, "bob");
  assert.equal(shown.lastActiveAt, ONLINE_ACTIVE.lastActiveAt);
});

test("preferences are independent per author", () => {
  const store = new PresenceVisibilityStore();
  store.update("alice", { showOnlineStatus: false, showLastActive: false });
  assert.deepEqual(store.get("bob"), { showOnlineStatus: true, showLastActive: true });
});
