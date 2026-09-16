import { test } from "node:test";
import assert from "node:assert/strict";
import { MuteMatchStore } from "./muteMatch";

test("mute rejects a missing author or match", () => {
  const store = new MuteMatchStore();
  const result = store.mute("", "bob", 1);
  assert.equal(result.success, false);
});

test("mute rejects muting yourself", () => {
  const store = new MuteMatchStore();
  const result = store.mute("alice", "alice", 1);
  assert.equal(result.success, false);
});

test("mute rejects an invalid duration", () => {
  const store = new MuteMatchStore();
  const result = store.mute("alice", "bob", 3);
  assert.equal(result.success, false);
});

test("mute succeeds with a valid duration and returns the expiry", () => {
  const store = new MuteMatchStore();
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const result = store.mute("alice", "bob", 4, now);
  assert.deepEqual(result, { success: true, mutedUntil: "2026-01-01T04:00:00.000Z" });
});

test("isMuted is true while within the muted window", () => {
  const store = new MuteMatchStore();
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  store.mute("alice", "bob", 4, now);
  assert.equal(store.isMuted("alice", "bob", now + 60 * 60 * 1000), true);
});

test("isMuted is false once the window has expired", () => {
  const store = new MuteMatchStore();
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  store.mute("alice", "bob", 1, now);
  assert.equal(store.isMuted("alice", "bob", now + 2 * 60 * 60 * 1000), false);
});

test("isMuted is false when never muted", () => {
  const store = new MuteMatchStore();
  assert.equal(store.isMuted("alice", "bob"), false);
});

test("unmute clears an active mute", () => {
  const store = new MuteMatchStore();
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  store.mute("alice", "bob", 4, now);
  store.unmute("alice", "bob");
  assert.equal(store.isMuted("alice", "bob", now), false);
});

test("mute is directional — muting bob doesn't mute alice from bob's side", () => {
  const store = new MuteMatchStore();
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  store.mute("alice", "bob", 4, now);
  assert.equal(store.isMuted("bob", "alice", now), false);
});

test("getMutedUntil returns null when not muted", () => {
  const store = new MuteMatchStore();
  assert.equal(store.getMutedUntil("alice", "bob"), null);
});

test("getMutedUntil returns the expiry timestamp while muted", () => {
  const store = new MuteMatchStore();
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  store.mute("alice", "bob", 8, now);
  assert.equal(store.getMutedUntil("alice", "bob", now), "2026-01-01T08:00:00.000Z");
});
