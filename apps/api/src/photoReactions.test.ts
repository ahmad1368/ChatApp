import { test } from "node:test";
import assert from "node:assert/strict";
import { PhotoReactionStore } from "./photoReactions";

test("react() accepts a valid reaction", () => {
  const store = new PhotoReactionStore();
  const result = store.react("photo-1", "alice", "❤️");
  assert.deepEqual(result, { success: true, emoji: "❤️" });
});

test("react() rejects a missing viewer", () => {
  const store = new PhotoReactionStore();
  const result = store.react("photo-1", "", "❤️");
  assert.equal(result.success, false);
});

test("react() rejects an invalid emoji", () => {
  const store = new PhotoReactionStore();
  const result = store.react("photo-1", "alice", "🍕");
  assert.equal(result.success, false);
});

test("react() replaces a viewer's previous reaction rather than stacking it", () => {
  const store = new PhotoReactionStore();
  store.react("photo-1", "alice", "❤️");
  store.react("photo-1", "alice", "🔥");
  assert.equal(store.getViewerReaction("photo-1", "alice"), "🔥");
  assert.deepEqual(store.getSummary("photo-1"), [{ emoji: "🔥", count: 1 }]);
});

test("getViewerReaction() is null before any reaction", () => {
  const store = new PhotoReactionStore();
  assert.equal(store.getViewerReaction("photo-1", "alice"), null);
});

test("removeReaction() clears the viewer's reaction", () => {
  const store = new PhotoReactionStore();
  store.react("photo-1", "alice", "❤️");
  const result = store.removeReaction("photo-1", "alice");
  assert.equal(result.success, true);
  assert.equal(store.getViewerReaction("photo-1", "alice"), null);
});

test("removeReaction() rejects a missing viewer", () => {
  const store = new PhotoReactionStore();
  assert.equal(store.removeReaction("photo-1", "").success, false);
});

test("getSummary() aggregates counts per emoji, highest first", () => {
  const store = new PhotoReactionStore();
  store.react("photo-1", "alice", "❤️");
  store.react("photo-1", "bob", "❤️");
  store.react("photo-1", "carol", "🔥");
  assert.deepEqual(store.getSummary("photo-1"), [
    { emoji: "❤️", count: 2 },
    { emoji: "🔥", count: 1 },
  ]);
});

test("getSummary() is empty for a photo with no reactions", () => {
  const store = new PhotoReactionStore();
  assert.deepEqual(store.getSummary("photo-1"), []);
});

test("reactions are tracked independently per photo", () => {
  const store = new PhotoReactionStore();
  store.react("photo-1", "alice", "❤️");
  assert.deepEqual(store.getSummary("photo-2"), []);
});
