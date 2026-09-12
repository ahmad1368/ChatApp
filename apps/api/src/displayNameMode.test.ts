import { test } from "node:test";
import assert from "node:assert/strict";
import { DisplayNameModeStore, resolveDisplayName, MAX_NICKNAME_LENGTH } from "./displayNameMode";

test("get() returns the default preference before any update", () => {
  const store = new DisplayNameModeStore();
  assert.deepEqual(store.get("alice"), { mode: "fullName", nickname: "" });
});

test("update() rejects a missing author", () => {
  const store = new DisplayNameModeStore();
  const result = store.update("", "firstNameOnly", "");
  assert.equal(result.success, false);
});

test("update() rejects an invalid mode", () => {
  const store = new DisplayNameModeStore();
  const result = store.update("alice", "middleName", "");
  assert.equal(result.success, false);
});

test("update() rejects a nickname over the character limit", () => {
  const store = new DisplayNameModeStore();
  const result = store.update("alice", "nickname", "a".repeat(MAX_NICKNAME_LENGTH + 1));
  assert.equal(result.success, false);
});

test("update() rejects a nickname containing a phone number", () => {
  const store = new DisplayNameModeStore();
  const result = store.update("alice", "nickname", "call 555-123-4567");
  assert.equal(result.success, false);
});

test("update() rejects mode nickname with an empty nickname", () => {
  const store = new DisplayNameModeStore();
  const result = store.update("alice", "nickname", "");
  assert.equal(result.success, false);
});

test("update() accepts firstNameOnly with no nickname, then get() returns it", () => {
  const store = new DisplayNameModeStore();
  const result = store.update("alice", "firstNameOnly", "");
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { mode: "firstNameOnly", nickname: "" });
});

test("update() accepts mode nickname with a nickname, then get() returns it", () => {
  const store = new DisplayNameModeStore();
  const result = store.update("alice", "nickname", "Al");
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { mode: "nickname", nickname: "Al" });
});

test("updating again replaces the previous preference for that author", () => {
  const store = new DisplayNameModeStore();
  store.update("alice", "nickname", "Al");
  store.update("alice", "fullName", "");
  assert.deepEqual(store.get("alice"), { mode: "fullName", nickname: "" });
});

test("each author's preference is independent", () => {
  const store = new DisplayNameModeStore();
  store.update("alice", "nickname", "Al");
  assert.deepEqual(store.get("bob"), { mode: "fullName", nickname: "" });
});

test("update() (#176) silently masks profanity in a nickname instead of rejecting it", () => {
  const store = new DisplayNameModeStore();
  const result = store.update("alice", "nickname", "little shit");
  assert.equal(result.success, true);
  assert.equal(store.get("alice").nickname, "little s***");
});

test("resolveDisplayName() returns the full name as-is for mode fullName", () => {
  assert.equal(resolveDisplayName("Alice Smith", { mode: "fullName", nickname: "" }), "Alice Smith");
});

test("resolveDisplayName() returns only the first word for mode firstNameOnly", () => {
  assert.equal(resolveDisplayName("Alice Smith", { mode: "firstNameOnly", nickname: "" }), "Alice");
});

test("resolveDisplayName() returns initials for mode initials", () => {
  assert.equal(resolveDisplayName("Alice Beatrice Smith", { mode: "initials", nickname: "" }), "ABS");
});

test("resolveDisplayName() returns the nickname for mode nickname", () => {
  assert.equal(resolveDisplayName("Alice Smith", { mode: "nickname", nickname: "Al" }), "Al");
});

test("resolveDisplayName() falls back to the full name when mode is nickname but none is set", () => {
  assert.equal(resolveDisplayName("Alice Smith", { mode: "nickname", nickname: "" }), "Alice Smith");
});

test("resolveDisplayName() handles a single-word full name for initials", () => {
  assert.equal(resolveDisplayName("Alice", { mode: "initials", nickname: "" }), "A");
});
