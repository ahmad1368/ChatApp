import { test } from "node:test";
import assert from "node:assert/strict";
import { FavoritesStore } from "./favorites";

test("addFavorite() adds a target to the viewer's favorites list", () => {
  const store = new FavoritesStore();
  const result = store.addFavorite("alice", "bob");
  assert.equal(result.success, true);
  assert.deepEqual(store.getFavorites("alice"), ["bob"]);
});

test("addFavorite() rejects missing viewerAuthor or targetAuthor", () => {
  const store = new FavoritesStore();
  assert.equal(store.addFavorite("", "bob").success, false);
  assert.equal(store.addFavorite("alice", "").success, false);
});

test("addFavorite() rejects favoriting yourself", () => {
  const store = new FavoritesStore();
  const result = store.addFavorite("alice", "alice");
  assert.equal(result.success, false);
});

test("addFavorite() is idempotent", () => {
  const store = new FavoritesStore();
  store.addFavorite("alice", "bob");
  store.addFavorite("alice", "bob");
  assert.deepEqual(store.getFavorites("alice"), ["bob"]);
});

test("addFavorite() is one-sided — favoriting from alice's side doesn't favorite for bob", () => {
  const store = new FavoritesStore();
  store.addFavorite("alice", "bob");
  assert.equal(store.isFavorite("alice", "bob"), true);
  assert.equal(store.isFavorite("bob", "alice"), false);
});

test("removeFavorite() removes a target from the viewer's favorites list", () => {
  const store = new FavoritesStore();
  store.addFavorite("alice", "bob");
  const result = store.removeFavorite("alice", "bob");
  assert.equal(result.success, true);
  assert.deepEqual(store.getFavorites("alice"), []);
});

test("removeFavorite() is a no-op for a target that was never favorited", () => {
  const store = new FavoritesStore();
  const result = store.removeFavorite("alice", "bob");
  assert.equal(result.success, true);
  assert.deepEqual(store.getFavorites("alice"), []);
});

test("isFavorite() is false for an untracked viewer", () => {
  const store = new FavoritesStore();
  assert.equal(store.isFavorite("alice", "bob"), false);
});

test("getFavorites() supports multiple favorites for the same viewer", () => {
  const store = new FavoritesStore();
  store.addFavorite("alice", "bob");
  store.addFavorite("alice", "carol");
  assert.deepEqual(new Set(store.getFavorites("alice")), new Set(["bob", "carol"]));
});
