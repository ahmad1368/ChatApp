import { test } from "node:test";
import assert from "node:assert/strict";
import { MembershipStore } from "./membership";

test("getJoinedAt() is null for an untracked author", () => {
  const store = new MembershipStore();
  assert.equal(store.getJoinedAt("alice"), null);
});

test("recordFirstSeen() stamps the current moment as the join date", () => {
  const store = new MembershipStore();
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const joinedAt = store.recordFirstSeen("alice", now);
  assert.equal(joinedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(store.getJoinedAt("alice"), "2026-01-01T00:00:00.000Z");
});

test("recordFirstSeen() never overwrites an existing join date", () => {
  const store = new MembershipStore();
  const first = Date.parse("2026-01-01T00:00:00.000Z");
  const later = Date.parse("2026-06-01T00:00:00.000Z");
  store.recordFirstSeen("alice", first);
  const result = store.recordFirstSeen("alice", later);
  assert.equal(result, "2026-01-01T00:00:00.000Z");
});

test("recordFirstSeen() returns null for a missing author", () => {
  const store = new MembershipStore();
  assert.equal(store.recordFirstSeen(""), null);
  assert.equal(store.recordFirstSeen(undefined), null);
});

test("each author's join date is independent", () => {
  const store = new MembershipStore();
  store.recordFirstSeen("alice", Date.parse("2026-01-01T00:00:00.000Z"));
  store.recordFirstSeen("bob", Date.parse("2026-02-01T00:00:00.000Z"));
  assert.equal(store.getJoinedAt("alice"), "2026-01-01T00:00:00.000Z");
  assert.equal(store.getJoinedAt("bob"), "2026-02-01T00:00:00.000Z");
});
