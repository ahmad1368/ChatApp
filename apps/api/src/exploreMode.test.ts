import { test } from "node:test";
import assert from "node:assert/strict";
import { ExploreModeStore, candidateMatchesExploreMode } from "./exploreMode";

test("get() returns null before any update", () => {
  const store = new ExploreModeStore();
  assert.equal(store.get("alice"), null);
});

test("update() rejects a missing author", () => {
  const store = new ExploreModeStore();
  const result = store.update("", "cafes");
  assert.equal(result.success, false);
});

test("update() rejects an invalid mode", () => {
  const store = new ExploreModeStore();
  const result = store.update("alice", "underwater-basket-weaving");
  assert.equal(result.success, false);
});

test("update() accepts a valid mode, then get() returns it", () => {
  const store = new ExploreModeStore();
  const result = store.update("alice", "sports");
  assert.equal(result.success, true);
  assert.equal(store.get("alice"), "sports");
});

test("update() accepts null to clear the active mode", () => {
  const store = new ExploreModeStore();
  store.update("alice", "sports");
  const result = store.update("alice", null);
  assert.equal(result.success, true);
  assert.equal(store.get("alice"), null);
});

test("each author's explore mode is independent", () => {
  const store = new ExploreModeStore();
  store.update("alice", "travel");
  assert.equal(store.get("bob"), null);
});

test("candidateMatchesExploreMode() matches everyone when no mode is active", () => {
  assert.equal(candidateMatchesExploreMode(null, []), true);
});

test("candidateMatchesExploreMode() excludes a candidate who shares none of the theme's interests", () => {
  assert.equal(candidateMatchesExploreMode("cafes", ["gaming", "dogs"]), false);
});

test("candidateMatchesExploreMode() includes a candidate who shares at least one of the theme's interests", () => {
  assert.equal(candidateMatchesExploreMode("cafes", ["gaming", "coffee"]), true);
});

test("candidateMatchesExploreMode() sports theme matches on a shared sports interest", () => {
  assert.equal(candidateMatchesExploreMode("sports", ["running"]), true);
});

test("candidateMatchesExploreMode() travel theme matches on a shared travel interest", () => {
  assert.equal(candidateMatchesExploreMode("travel", ["camping"]), true);
});
