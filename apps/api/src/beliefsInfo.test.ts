import { test } from "node:test";
import assert from "node:assert/strict";
import { BeliefsInfoStore } from "./beliefsInfo";

test("get() returns empty fields before any update", () => {
  const store = new BeliefsInfoStore();
  assert.deepEqual(store.get("alice"), {
    religion: null,
    politicalView: null,
    hideReligion: false,
    hidePoliticalView: false,
  });
});

test("update() rejects a missing author", () => {
  const store = new BeliefsInfoStore();
  const result = store.update("", "buddhist", "moderate", false, false);
  assert.equal(result.success, false);
});

test("update() rejects an invalid religion option", () => {
  const store = new BeliefsInfoStore();
  const result = store.update("alice", "pastafarian", "moderate", false, false);
  assert.equal(result.success, false);
});

test("update() rejects an invalid political view option", () => {
  const store = new BeliefsInfoStore();
  const result = store.update("alice", "buddhist", "anarchist", false, false);
  assert.equal(result.success, false);
});

test("update() accepts null for both fields to clear them", () => {
  const store = new BeliefsInfoStore();
  store.update("alice", "atheist", "liberal", false, false);
  const result = store.update("alice", null, null, false, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), {
    religion: null,
    politicalView: null,
    hideReligion: false,
    hidePoliticalView: false,
  });
});

test("update() accepts valid options and independent hide flags, then get() returns them", () => {
  const store = new BeliefsInfoStore();
  const result = store.update("alice", "spiritual", "notPolitical", true, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), {
    religion: "spiritual",
    politicalView: "notPolitical",
    hideReligion: true,
    hidePoliticalView: false,
  });
});

test("updating again replaces the previous beliefs info for that author", () => {
  const store = new BeliefsInfoStore();
  store.update("alice", "christian", "conservative", false, false);
  store.update("alice", "agnostic", "liberal", true, true);
  assert.deepEqual(store.get("alice"), {
    religion: "agnostic",
    politicalView: "liberal",
    hideReligion: true,
    hidePoliticalView: true,
  });
});

test("each author's beliefs info is independent", () => {
  const store = new BeliefsInfoStore();
  store.update("alice", "buddhist", "moderate", false, false);
  assert.deepEqual(store.get("bob"), {
    religion: null,
    politicalView: null,
    hideReligion: false,
    hidePoliticalView: false,
  });
});
