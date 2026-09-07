import { test } from "node:test";
import assert from "node:assert/strict";
import { LanguagesInfoStore, LANGUAGE_CATALOG, MAX_SELECTED_LANGUAGES } from "./languagesInfo";

test("get() returns empty fields before any update", () => {
  const store = new LanguagesInfoStore();
  assert.deepEqual(store.get("alice"), { languages: [], hideLanguages: false });
});

test("update() rejects a missing author", () => {
  const store = new LanguagesInfoStore();
  const result = store.update("", ["english"], false);
  assert.equal(result.success, false);
});

test("update() rejects a non-array languages value", () => {
  const store = new LanguagesInfoStore();
  const result = store.update("alice", "english", false);
  assert.equal(result.success, false);
});

test("update() rejects more than the max number of languages", () => {
  const store = new LanguagesInfoStore();
  const result = store.update("alice", LANGUAGE_CATALOG.slice(0, MAX_SELECTED_LANGUAGES + 1), false);
  assert.equal(result.success, false);
});

test("update() rejects an unknown language", () => {
  const store = new LanguagesInfoStore();
  const result = store.update("alice", ["klingon"], false);
  assert.equal(result.success, false);
});

test("update() rejects duplicate languages", () => {
  const store = new LanguagesInfoStore();
  const result = store.update("alice", ["english", "english"], false);
  assert.equal(result.success, false);
});

test("update() accepts an empty list", () => {
  const store = new LanguagesInfoStore();
  const result = store.update("alice", [], false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { languages: [], hideLanguages: false });
});

test("update() accepts valid languages and hideLanguages, then get() returns them", () => {
  const store = new LanguagesInfoStore();
  const result = store.update("alice", ["english", "spanish"], true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { languages: ["english", "spanish"], hideLanguages: true });
});

test("updating again replaces the previous list for that author", () => {
  const store = new LanguagesInfoStore();
  store.update("alice", ["english"], false);
  store.update("alice", ["french", "german"], false);
  assert.deepEqual(store.get("alice"), { languages: ["french", "german"], hideLanguages: false });
});

test("each author's languages are independent", () => {
  const store = new LanguagesInfoStore();
  store.update("alice", ["english"], false);
  assert.deepEqual(store.get("bob"), { languages: [], hideLanguages: false });
});
