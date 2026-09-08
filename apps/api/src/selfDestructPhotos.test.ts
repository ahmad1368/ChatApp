import { test } from "node:test";
import assert from "node:assert/strict";
import { SelfDestructPhotoStore } from "./selfDestructPhotos";

const TINY_DATA = Buffer.from("photo bytes").toString("base64");

test("save() rejects a missing author", () => {
  const store = new SelfDestructPhotoStore();
  const result = store.save("", "image/png", TINY_DATA);
  assert.deepEqual(result, { success: false, error: "author is required" });
});

test("save() rejects an unsupported mime type", () => {
  const store = new SelfDestructPhotoStore();
  const result = store.save("alice", "image/gif", TINY_DATA);
  assert.equal(result.success, false);
});

test("save() rejects invalid base64 data", () => {
  const store = new SelfDestructPhotoStore();
  const result = store.save("alice", "image/png", "");
  assert.equal(result.success, false);
});

test("save() rejects data over the 5MB limit", () => {
  const store = new SelfDestructPhotoStore();
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64");
  const result = store.save("alice", "image/png", oversized);
  assert.equal(result.success, false);
});

test("view() returns the photo for the sender, and again on a second view", () => {
  const store = new SelfDestructPhotoStore();
  const result = store.save("alice", "image/png", TINY_DATA);
  assert.equal(result.success, true);
  if (!result.success) return;

  const firstView = store.view(result.id, "alice");
  assert.equal(firstView?.data.toString(), "photo bytes");
  const secondView = store.view(result.id, "alice");
  assert.equal(secondView?.data.toString(), "photo bytes");
});

test("view() returns the photo once for a non-sender, then destroys it", () => {
  const store = new SelfDestructPhotoStore();
  const result = store.save("alice", "image/png", TINY_DATA);
  assert.equal(result.success, true);
  if (!result.success) return;

  const firstView = store.view(result.id, "bob");
  assert.equal(firstView?.data.toString(), "photo bytes");
  const secondView = store.view(result.id, "bob");
  assert.equal(secondView, undefined);
});

test("view() destroys the photo for the sender too, once a non-sender has viewed it", () => {
  const store = new SelfDestructPhotoStore();
  const result = store.save("alice", "image/png", TINY_DATA);
  assert.equal(result.success, true);
  if (!result.success) return;

  store.view(result.id, "bob");
  const senderViewAfter = store.view(result.id, "alice");
  assert.equal(senderViewAfter, undefined);
});

test("view() returns undefined for an unknown id", () => {
  const store = new SelfDestructPhotoStore();
  assert.equal(store.view("unknown", "alice"), undefined);
});

test("hasBeenViewed() is false before a destroying view and true after", () => {
  const store = new SelfDestructPhotoStore();
  const result = store.save("alice", "image/png", TINY_DATA);
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(store.hasBeenViewed(result.id), false);
  store.view(result.id, "bob");
  assert.equal(store.hasBeenViewed(result.id), true);
});

test("hasBeenViewed() stays false while only the sender has viewed it", () => {
  const store = new SelfDestructPhotoStore();
  const result = store.save("alice", "image/png", TINY_DATA);
  assert.equal(result.success, true);
  if (!result.success) return;

  store.view(result.id, "alice");
  assert.equal(store.hasBeenViewed(result.id), false);
});
