import { test } from "node:test";
import assert from "node:assert/strict";
import { SuperLikeOptOutStore } from "./superLikeOptOut";

test("isDisabled defaults to false", () => {
  const store = new SuperLikeOptOutStore();
  assert.equal(store.isDisabled("alice"), false);
});

test("setDisabled(true) disables Super Likes for an author", () => {
  const store = new SuperLikeOptOutStore();
  store.setDisabled("alice", true);
  assert.equal(store.isDisabled("alice"), true);
});

test("setDisabled(false) re-enables Super Likes for an author", () => {
  const store = new SuperLikeOptOutStore();
  store.setDisabled("alice", true);
  store.setDisabled("alice", false);
  assert.equal(store.isDisabled("alice"), false);
});

test("the setting is tracked independently per author", () => {
  const store = new SuperLikeOptOutStore();
  store.setDisabled("alice", true);
  assert.equal(store.isDisabled("bob"), false);
});
