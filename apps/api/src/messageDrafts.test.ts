import { test } from "node:test";
import assert from "node:assert/strict";
import { MessageDraftStore } from "./messageDrafts";

test("save() rejects a missing author", () => {
  const store = new MessageDraftStore();
  const result = store.save("", "general", "hey there");
  assert.equal(result.success, false);
});

test("save() rejects a missing roomId", () => {
  const store = new MessageDraftStore();
  const result = store.save("alice", "", "hey there");
  assert.equal(result.success, false);
});

test("save() rejects a non-string text", () => {
  const store = new MessageDraftStore();
  const result = store.save("alice", "general", 42);
  assert.equal(result.success, false);
});

test("save() then get() returns the saved draft", () => {
  const store = new MessageDraftStore();
  store.save("alice", "general", "hey there");
  assert.equal(store.get("alice", "general"), "hey there");
});

test("get() returns an empty string when no draft was saved", () => {
  const store = new MessageDraftStore();
  assert.equal(store.get("alice", "general"), "");
});

test("saving a blank/whitespace-only draft clears it instead of storing it", () => {
  const store = new MessageDraftStore();
  store.save("alice", "general", "hey there");
  store.save("alice", "general", "   ");
  assert.equal(store.get("alice", "general"), "");
});

test("drafts are independent per room for the same author", () => {
  const store = new MessageDraftStore();
  store.save("alice", "general", "draft one");
  store.save("alice", "other-room", "draft two");
  assert.equal(store.get("alice", "general"), "draft one");
  assert.equal(store.get("alice", "other-room"), "draft two");
});

test("drafts are independent per author for the same room", () => {
  const store = new MessageDraftStore();
  store.save("alice", "general", "alice's draft");
  store.save("bob", "general", "bob's draft");
  assert.equal(store.get("alice", "general"), "alice's draft");
  assert.equal(store.get("bob", "general"), "bob's draft");
});

test("clear() removes a saved draft", () => {
  const store = new MessageDraftStore();
  store.save("alice", "general", "hey there");
  store.clear("alice", "general");
  assert.equal(store.get("alice", "general"), "");
});

test("clear() on a nonexistent draft is a no-op", () => {
  const store = new MessageDraftStore();
  store.clear("alice", "general");
  assert.equal(store.get("alice", "general"), "");
});
