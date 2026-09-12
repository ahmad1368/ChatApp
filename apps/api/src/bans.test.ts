import test from "node:test";
import assert from "node:assert/strict";
import { BanStore } from "./bans";

test("a user with no ban record is neither banned nor shadowbanned", () => {
  const store = new BanStore();
  assert.equal(store.isBanned("user-1"), false);
  assert.equal(store.isShadowbanned("user-1"), false);
  assert.equal(store.getStatus("user-1"), null);
});

test("apply() rejects a missing userId", () => {
  const store = new BanStore();
  const result = store.apply("", "banned", "spam", "admin", "permanent");
  assert.equal(result.success, false);
});

test("apply() rejects an invalid mode", () => {
  const store = new BanStore();
  const result = store.apply("user-1", "muted", "spam", "admin");
  assert.equal(result.success, false);
});

test("apply() rejects a missing reason", () => {
  const store = new BanStore();
  const result = store.apply("user-1", "banned", "", "admin", "permanent");
  assert.equal(result.success, false);
});

test("apply() rejects a missing bannedBy", () => {
  const store = new BanStore();
  const result = store.apply("user-1", "banned", "spam", "", "permanent");
  assert.equal(result.success, false);
});

test("apply() with mode banned requires a valid type", () => {
  const store = new BanStore();
  const result = store.apply("user-1", "banned", "spam", "admin");
  assert.equal(result.success, false);
});

test("apply() with a temporary ban requires a positive durationHours", () => {
  const store = new BanStore();
  const zero = store.apply("user-1", "banned", "spam", "admin", "temporary", 0);
  assert.equal(zero.success, false);
  const negative = store.apply("user-1", "banned", "spam", "admin", "temporary", -5);
  assert.equal(negative.success, false);
  const notANumber = store.apply("user-1", "banned", "spam", "admin", "temporary", "soon");
  assert.equal(notANumber.success, false);
});

test("a permanent ban makes isBanned() true with no expiry", () => {
  const store = new BanStore();
  const result = store.apply("user-1", "banned", "harassment", "admin", "permanent");
  assert.equal(result.success, true);
  assert.equal(store.isBanned("user-1"), true);
  assert.equal(store.isShadowbanned("user-1"), false);
  const status = store.getStatus("user-1");
  assert.equal(status?.expiresAt, null);
  assert.equal(status?.type, "permanent");
});

test("a temporary ban is active before expiry and lifts itself automatically after", () => {
  const store = new BanStore();
  store.apply("user-1", "banned", "spam", "admin", "temporary", 1);
  assert.equal(store.isBanned("user-1"), true);

  const status = store.getStatus("user-1");
  assert.ok(status?.expiresAt);
  const record = (store as unknown as { bansByUserId: Map<string, { expiresAt: string | null }> }).bansByUserId.get(
    "user-1"
  );
  if (record) record.expiresAt = new Date(Date.now() - 1000).toISOString();

  assert.equal(store.isBanned("user-1"), false);
  assert.equal(store.getStatus("user-1"), null);
});

test("shadowban sets isShadowbanned() true and isBanned() false", () => {
  const store = new BanStore();
  const result = store.apply("user-1", "shadowbanned", "fake profile", "admin");
  assert.equal(result.success, true);
  assert.equal(result.success && result.entry.type, undefined);
  assert.equal(store.isShadowbanned("user-1"), true);
  assert.equal(store.isBanned("user-1"), false);
});

test("lift() removes an active ban and returns true; false when nothing to remove", () => {
  const store = new BanStore();
  store.apply("user-1", "banned", "spam", "admin", "permanent");
  assert.equal(store.lift("user-1"), true);
  assert.equal(store.isBanned("user-1"), false);
  assert.equal(store.lift("user-1"), false);
});

test("each user's ban status is independent", () => {
  const store = new BanStore();
  store.apply("user-1", "banned", "spam", "admin", "permanent");
  store.apply("user-2", "shadowbanned", "fake profile", "admin");
  assert.equal(store.isBanned("user-1"), true);
  assert.equal(store.isShadowbanned("user-1"), false);
  assert.equal(store.isBanned("user-2"), false);
  assert.equal(store.isShadowbanned("user-2"), true);
});

test("getActiveBans() lists every currently-active ban, most recently issued first", () => {
  const store = new BanStore();
  store.apply("user-1", "banned", "spam", "admin", "permanent");
  store.apply("user-2", "shadowbanned", "fake profile", "admin");
  const active = store.getActiveBans();
  assert.equal(active.length, 2);
  assert.equal(active[0].userId, "user-2");
  assert.equal(active[1].userId, "user-1");
});

test("getActiveBans() excludes an expired temporary ban", () => {
  const store = new BanStore();
  store.apply("user-1", "banned", "spam", "admin", "temporary", 1);
  const record = (store as unknown as { bansByUserId: Map<string, { expiresAt: string | null }> }).bansByUserId.get(
    "user-1"
  );
  if (record) record.expiresAt = new Date(Date.now() - 1000).toISOString();
  assert.deepEqual(store.getActiveBans(), []);
});

test("applying a new ban replaces a previous one for the same user", () => {
  const store = new BanStore();
  store.apply("user-1", "shadowbanned", "fake profile", "admin");
  store.apply("user-1", "banned", "harassment", "admin", "permanent");
  assert.equal(store.isShadowbanned("user-1"), false);
  assert.equal(store.isBanned("user-1"), true);
});
