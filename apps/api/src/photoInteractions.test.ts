import { test } from "node:test";
import assert from "node:assert/strict";
import { PhotoInteractionStore, MAX_NOTE_LENGTH } from "./photoInteractions";

test("toggleLike() rejects a missing liker/owner/photoId", () => {
  const store = new PhotoInteractionStore();
  assert.deepEqual(store.toggleLike("", "bob", "p1"), { success: false, error: "liker is required" });
  assert.deepEqual(store.toggleLike("alice", "", "p1"), { success: false, error: "owner is required" });
  assert.deepEqual(store.toggleLike("alice", "bob", ""), { success: false, error: "photoId is required" });
});

test("toggleLike() rejects liking your own photo", () => {
  const store = new PhotoInteractionStore();
  assert.deepEqual(store.toggleLike("alice", "alice", "p1"), {
    success: false,
    error: "Cannot like your own photo",
  });
});

test("toggleLike() likes a photo, then toggles the like back off", () => {
  const store = new PhotoInteractionStore();
  assert.deepEqual(store.toggleLike("alice", "bob", "p1"), { success: true, liked: true });
  assert.equal(store.hasLiked("alice", "bob", "p1"), true);
  assert.equal(store.getLikeCount("bob", "p1"), 1);

  assert.deepEqual(store.toggleLike("alice", "bob", "p1"), { success: true, liked: false });
  assert.equal(store.hasLiked("alice", "bob", "p1"), false);
  assert.equal(store.getLikeCount("bob", "p1"), 0);
});

test("likes are independent per photo", () => {
  const store = new PhotoInteractionStore();
  store.toggleLike("alice", "bob", "p1");
  assert.equal(store.getLikeCount("bob", "p2"), 0);
  assert.equal(store.hasLiked("alice", "bob", "p2"), false);
});

test("likes are independent per owner even with the same photoId", () => {
  const store = new PhotoInteractionStore();
  store.toggleLike("alice", "bob", "p1");
  assert.equal(store.getLikeCount("carol", "p1"), 0);
});

test("multiple likers on the same photo all count", () => {
  const store = new PhotoInteractionStore();
  store.toggleLike("alice", "bob", "p1");
  store.toggleLike("carol", "bob", "p1");
  assert.equal(store.getLikeCount("bob", "p1"), 2);
});

test("sendNote() rejects a missing sender/owner/photoId/text", () => {
  const store = new PhotoInteractionStore();
  assert.deepEqual(store.sendNote("", "bob", "p1", "hi"), { success: false, error: "sender is required" });
  assert.deepEqual(store.sendNote("alice", "", "p1", "hi"), { success: false, error: "owner is required" });
  assert.deepEqual(store.sendNote("alice", "bob", "", "hi"), { success: false, error: "photoId is required" });
  assert.deepEqual(store.sendNote("alice", "bob", "p1", ""), { success: false, error: "text is required" });
});

test("sendNote() rejects sending a note on your own photo", () => {
  const store = new PhotoInteractionStore();
  assert.deepEqual(store.sendNote("alice", "alice", "p1", "hi"), {
    success: false,
    error: "Cannot send a note on your own photo",
  });
});

test("sendNote() rejects text over the max length", () => {
  const store = new PhotoInteractionStore();
  const result = store.sendNote("alice", "bob", "p1", "x".repeat(MAX_NOTE_LENGTH + 1));
  assert.deepEqual(result, { success: false, error: `text must be ${MAX_NOTE_LENGTH} characters or fewer` });
});

test("sendNote() stores the note, retrievable via getNotes()", () => {
  const store = new PhotoInteractionStore();
  const result = store.sendNote("alice", "bob", "p1", "Great shot!");
  assert.equal(result.success, true);
  const notes = store.getNotes("bob", "p1");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].author, "alice");
  assert.equal(notes[0].text, "Great shot!");
  assert.equal(typeof notes[0].createdAt, "string");
});

test("getNotes() preserves order across multiple notes", () => {
  const store = new PhotoInteractionStore();
  store.sendNote("alice", "bob", "p1", "first");
  store.sendNote("carol", "bob", "p1", "second");
  assert.deepEqual(store.getNotes("bob", "p1").map((n) => n.text), ["first", "second"]);
});

test("notes are independent per photo", () => {
  const store = new PhotoInteractionStore();
  store.sendNote("alice", "bob", "p1", "hi");
  assert.deepEqual(store.getNotes("bob", "p2"), []);
});
