import { test } from "node:test";
import assert from "node:assert/strict";
import { PhotoStore } from "./photos";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("upload() stores a valid photo and returns an id", () => {
  const store = new PhotoStore();
  const result = store.upload("alice", "image/png", TINY_PNG_BASE64);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.photo.author, "alice");
    assert.equal(result.photo.mimeType, "image/png");
    assert.ok(store.get(result.photo.id));
  }
});

test("upload() rejects missing author", () => {
  const store = new PhotoStore();
  const result = store.upload("", "image/png", TINY_PNG_BASE64);
  assert.equal(result.success, false);
});

test("upload() rejects disallowed mime types", () => {
  const store = new PhotoStore();
  const result = store.upload("alice", "image/gif", TINY_PNG_BASE64);
  assert.equal(result.success, false);
});

test("upload() rejects oversized photos", () => {
  const store = new PhotoStore();
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64");
  const result = store.upload("alice", "image/png", oversized);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error, /5MB/);
  }
});

test("get() returns undefined for an unknown id", () => {
  const store = new PhotoStore();
  assert.equal(store.get("does-not-exist"), undefined);
});
