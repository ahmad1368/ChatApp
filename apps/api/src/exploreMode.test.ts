import { test } from "node:test";
import assert from "node:assert/strict";
import { ExploreModeStore, candidateMatchesExploreMode } from "./exploreMode";
import { ExploreThemeStore } from "./exploreThemes";

function createStoreWithTheme(): { store: ExploreModeStore; themeId: string } {
  const themeStore = new ExploreThemeStore();
  const created = themeStore.create("Cafes", ["coffee", "baking"]);
  const themeId = created.success ? created.theme.id : "";
  return { store: new ExploreModeStore(themeStore), themeId };
}

test("get() returns null before any update", () => {
  const { store } = createStoreWithTheme();
  assert.equal(store.get("alice"), null);
});

test("update() rejects a missing author", () => {
  const { store, themeId } = createStoreWithTheme();
  const result = store.update("", themeId);
  assert.equal(result.success, false);
});

test("update() rejects an unknown theme id", () => {
  const { store } = createStoreWithTheme();
  const result = store.update("alice", "not-a-real-theme");
  assert.equal(result.success, false);
});

test("update() rejects a theme that's been deactivated", () => {
  const themeStore = new ExploreThemeStore();
  const created = themeStore.create("Cafes", ["coffee"]);
  const themeId = created.success ? created.theme.id : "";
  themeStore.update(themeId, { active: false });
  const store = new ExploreModeStore(themeStore);

  const result = store.update("alice", themeId);
  assert.equal(result.success, false);
});

test("update() accepts a valid, active theme id, then get() returns it", () => {
  const { store, themeId } = createStoreWithTheme();
  const result = store.update("alice", themeId);
  assert.equal(result.success, true);
  assert.equal(store.get("alice"), themeId);
});

test("update() accepts null to clear the active mode", () => {
  const { store, themeId } = createStoreWithTheme();
  store.update("alice", themeId);
  const result = store.update("alice", null);
  assert.equal(result.success, true);
  assert.equal(store.get("alice"), null);
});

test("each author's explore mode is independent", () => {
  const { store, themeId } = createStoreWithTheme();
  store.update("alice", themeId);
  assert.equal(store.get("bob"), null);
});

test("candidateMatchesExploreMode() matches everyone when no theme is active", () => {
  assert.equal(candidateMatchesExploreMode(null, []), true);
});

test("candidateMatchesExploreMode() excludes a candidate who shares none of the theme's interests", () => {
  assert.equal(candidateMatchesExploreMode(["coffee", "baking"], ["gaming", "dogs"]), false);
});

test("candidateMatchesExploreMode() includes a candidate who shares at least one of the theme's interests", () => {
  assert.equal(candidateMatchesExploreMode(["coffee", "baking"], ["gaming", "coffee"]), true);
});
