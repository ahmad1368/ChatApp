import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileColorThemeStore } from "./profileColorTheme";

test("get() returns the default theme before any update", () => {
  const store = new ProfileColorThemeStore();
  assert.equal(store.get("alice"), "classic");
});

test("set() rejects a missing author", () => {
  const store = new ProfileColorThemeStore();
  const result = store.set("", "sunset");
  assert.equal(result.success, false);
});

test("set() rejects an invalid theme", () => {
  const store = new ProfileColorThemeStore();
  const result = store.set("alice", "chartreuse");
  assert.equal(result.success, false);
});

test("set() accepts a valid theme, then get() returns it", () => {
  const store = new ProfileColorThemeStore();
  const result = store.set("alice", "ocean");
  assert.equal(result.success, true);
  assert.equal(store.get("alice"), "ocean");
});

test("setting again replaces the previous theme for that author", () => {
  const store = new ProfileColorThemeStore();
  store.set("alice", "ocean");
  store.set("alice", "midnight");
  assert.equal(store.get("alice"), "midnight");
});

test("each author's theme is independent", () => {
  const store = new ProfileColorThemeStore();
  store.set("alice", "sunset");
  assert.equal(store.get("bob"), "classic");
});
