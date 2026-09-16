import { test } from "node:test";
import assert from "node:assert/strict";
import { StrangerPictureBlockStore } from "./strangerPictureBlock";

test("get() defaults to false for an untracked author", () => {
  const store = new StrangerPictureBlockStore();
  assert.equal(store.get("alice"), false);
});

test("update() sets and persists the preference", () => {
  const store = new StrangerPictureBlockStore();
  const result = store.update("alice", true);
  assert.equal(result.success, true);
  assert.equal(store.get("alice"), true);
});

test("update() rejects a missing author", () => {
  const store = new StrangerPictureBlockStore();
  assert.equal(store.update("", true).success, false);
});

test("update() rejects a non-boolean enabled value", () => {
  const store = new StrangerPictureBlockStore();
  assert.equal(store.update("alice", "yes").success, false);
});

test("shouldHidePicture() is false when the viewer hasn't enabled the setting", () => {
  const store = new StrangerPictureBlockStore();
  assert.equal(store.shouldHidePicture("alice", "bob", true, false), false);
});

test("shouldHidePicture() is true for a stranger's picture once enabled", () => {
  const store = new StrangerPictureBlockStore();
  store.update("alice", true);
  assert.equal(store.shouldHidePicture("alice", "bob", true, false), true);
});

test("shouldHidePicture() is false for a match's picture even with the setting enabled", () => {
  const store = new StrangerPictureBlockStore();
  store.update("alice", true);
  assert.equal(store.shouldHidePicture("alice", "bob", true, true), false);
});

test("shouldHidePicture() is false for a text-only message", () => {
  const store = new StrangerPictureBlockStore();
  store.update("alice", true);
  assert.equal(store.shouldHidePicture("alice", "bob", false, false), false);
});

test("shouldHidePicture() is false for the viewer's own picture", () => {
  const store = new StrangerPictureBlockStore();
  store.update("alice", true);
  assert.equal(store.shouldHidePicture("alice", "alice", true, false), false);
});
