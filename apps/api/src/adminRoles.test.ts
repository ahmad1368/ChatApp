import test from "node:test";
import assert from "node:assert/strict";
import { AdminRoleStore } from "./adminRoles";

test("create() rejects a missing name or invalid role", () => {
  const store = new AdminRoleStore();
  assert.equal(store.create("", "moderator").success, false);
  assert.equal(store.create("Jamie", "owner").success, false);
  assert.equal(store.create("Jamie", undefined).success, false);
});

test("create() succeeds with a generated api key and appears in list() without it", () => {
  const store = new AdminRoleStore();
  const result = store.create("Jamie", "moderator");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.account.role, "moderator");
  assert.equal(typeof result.account.apiKey, "string");
  assert.ok(result.account.apiKey.length > 0);

  const listed = store.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, result.account.id);
  assert.equal((listed[0] as unknown as { apiKey?: string }).apiKey, undefined);
});

test("findRoleByApiKey() resolves a live key to its role", () => {
  const store = new AdminRoleStore();
  const result = store.create("Jamie", "finance");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(store.findRoleByApiKey(result.account.apiKey), "finance");
  assert.equal(store.findRoleByApiKey("not-a-real-key"), undefined);
});

test("revoke() disables a key's role lookup and cannot be revoked twice", () => {
  const store = new AdminRoleStore();
  const result = store.create("Jamie", "support");
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(store.revoke(result.account.id), true);
  assert.equal(store.findRoleByApiKey(result.account.apiKey), undefined);
  assert.equal(store.revoke(result.account.id), false);
  assert.equal(store.revoke("does-not-exist"), false);
});

test("list() reflects revoked status without removing the account", () => {
  const store = new AdminRoleStore();
  const result = store.create("Jamie", "moderator");
  assert.equal(result.success, true);
  if (!result.success) return;
  store.revoke(result.account.id);
  const listed = store.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].revoked, true);
});
