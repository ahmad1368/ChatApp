import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileNoteStore } from "./profileNotes";

test("setNote saves a note and returns it", () => {
  const store = new ProfileNoteStore();
  const result = store.setNote("alice", "bob", "met at the coffee shop");
  assert.deepEqual(result, { success: true, note: "met at the coffee shop" });
});

test("setNote trims whitespace", () => {
  const store = new ProfileNoteStore();
  store.setNote("alice", "bob", "  hello  ");
  assert.equal(store.getNote("alice", "bob"), "hello");
});

test("setNote rejects a note over the length limit", () => {
  const store = new ProfileNoteStore();
  const result = store.setNote("alice", "bob", "x".repeat(501));
  assert.equal(result.success, false);
});

test("setNote with empty text clears the note", () => {
  const store = new ProfileNoteStore();
  store.setNote("alice", "bob", "some note");
  store.setNote("alice", "bob", "");
  assert.equal(store.getNote("alice", "bob"), null);
});

test("getNote returns null before any note is set", () => {
  const store = new ProfileNoteStore();
  assert.equal(store.getNote("alice", "bob"), null);
});

test("deleteNote removes an existing note", () => {
  const store = new ProfileNoteStore();
  store.setNote("alice", "bob", "note");
  store.deleteNote("alice", "bob");
  assert.equal(store.getNote("alice", "bob"), null);
});

test("notes are private per-viewer — one viewer's note isn't visible to another", () => {
  const store = new ProfileNoteStore();
  store.setNote("alice", "bob", "alice's note about bob");
  assert.equal(store.getNote("carol", "bob"), null);
});

test("notes are tracked independently per subject", () => {
  const store = new ProfileNoteStore();
  store.setNote("alice", "bob", "note about bob");
  assert.equal(store.getNote("alice", "carol"), null);
});

test("setNote overwrites a previous note for the same viewer and subject", () => {
  const store = new ProfileNoteStore();
  store.setNote("alice", "bob", "first note");
  store.setNote("alice", "bob", "updated note");
  assert.equal(store.getNote("alice", "bob"), "updated note");
});
