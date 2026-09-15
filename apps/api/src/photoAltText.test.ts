import test from "node:test";
import assert from "node:assert/strict";
import { PhotoAltTextStore, MAX_ALT_TEXT_LENGTH } from "./photoAltText";

test("setAltText() rejects a missing owner or photoId", () => {
  const store = new PhotoAltTextStore();
  assert.equal(store.setAltText("", "p1", "A photo of me hiking").success, false);
  assert.equal(store.setAltText("alice", "", "A photo of me hiking").success, false);
});

test("setAltText() rejects text longer than the max length", () => {
  const store = new PhotoAltTextStore();
  const tooLong = "a".repeat(MAX_ALT_TEXT_LENGTH + 1);
  assert.equal(store.setAltText("alice", "p1", tooLong).success, false);
});

test("setAltText() succeeds and getAltText() returns the trimmed text", () => {
  const store = new PhotoAltTextStore();
  const result = store.setAltText("alice", "p1", "  A sunset over the mountains  ");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.altText, "A sunset over the mountains");
  assert.equal(store.getAltText("alice", "p1"), "A sunset over the mountains");
});

test("getAltText() returns undefined for a photo that never got alt text", () => {
  const store = new PhotoAltTextStore();
  assert.equal(store.getAltText("alice", "not-a-real-photo"), undefined);
});

test("setAltText() with empty text clears any existing alt text", () => {
  const store = new PhotoAltTextStore();
  store.setAltText("alice", "p1", "A photo of a dog");
  const result = store.setAltText("alice", "p1", "   ");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.altText, "");
  assert.equal(store.getAltText("alice", "p1"), undefined);
});

test("alt text is scoped per owner+photoId independently", () => {
  const store = new PhotoAltTextStore();
  store.setAltText("alice", "p1", "Alice's photo");
  store.setAltText("bob", "p1", "Bob's photo");
  assert.equal(store.getAltText("alice", "p1"), "Alice's photo");
  assert.equal(store.getAltText("bob", "p1"), "Bob's photo");
});
