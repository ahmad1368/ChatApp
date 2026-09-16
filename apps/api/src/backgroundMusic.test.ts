import { test } from "node:test";
import assert from "node:assert/strict";
import { BackgroundMusicStore } from "./backgroundMusic";

const TINY_BASE64 = Buffer.from("not a real audio clip, just bytes").toString("base64");

test("get() returns undefined before any upload", () => {
  const store = new BackgroundMusicStore();
  assert.equal(store.get("alice"), undefined);
});

test("upload() rejects a missing author", () => {
  const store = new BackgroundMusicStore();
  const result = store.upload("", "audio/mpeg", TINY_BASE64);
  assert.equal(result.success, false);
});

test("upload() rejects an unsupported mime type", () => {
  const store = new BackgroundMusicStore();
  const result = store.upload("alice", "audio/flac", TINY_BASE64);
  assert.equal(result.success, false);
});

test("upload() rejects missing data", () => {
  const store = new BackgroundMusicStore();
  const result = store.upload("alice", "audio/mpeg", "");
  assert.equal(result.success, false);
});

test("upload() rejects a clip over the size cap", () => {
  const store = new BackgroundMusicStore();
  const oversized = Buffer.alloc(9 * 1024 * 1024).toString("base64");
  const result = store.upload("alice", "audio/mpeg", oversized);
  assert.equal(result.success, false);
});

test("upload() accepts a valid track with a title and get() returns it", () => {
  const store = new BackgroundMusicStore();
  const result = store.upload("alice", "audio/mpeg", TINY_BASE64, "My favorite song");
  assert.equal(result.success, true);
  const stored = store.get("alice");
  assert.equal(stored?.mimeType, "audio/mpeg");
  assert.equal(stored?.title, "My favorite song");
  assert.deepEqual(stored?.data, Buffer.from(TINY_BASE64, "base64"));
});

test("upload() accepts a track without a title", () => {
  const store = new BackgroundMusicStore();
  store.upload("alice", "audio/mpeg", TINY_BASE64);
  assert.equal(store.get("alice")?.title, "");
});

test("upload() truncates an overly long title", () => {
  const store = new BackgroundMusicStore();
  store.upload("alice", "audio/mpeg", TINY_BASE64, "x".repeat(200));
  assert.equal(store.get("alice")?.title.length, 80);
});

test("uploading again replaces the previous track for that author", () => {
  const store = new BackgroundMusicStore();
  store.upload("alice", "audio/mpeg", TINY_BASE64, "First song");
  const secondBase64 = Buffer.from("a different track").toString("base64");
  store.upload("alice", "audio/wav", secondBase64, "Second song");
  const stored = store.get("alice");
  assert.equal(stored?.mimeType, "audio/wav");
  assert.equal(stored?.title, "Second song");
  assert.deepEqual(stored?.data, Buffer.from(secondBase64, "base64"));
});

test("remove() deletes the stored track and reports whether one existed", () => {
  const store = new BackgroundMusicStore();
  assert.equal(store.remove("alice"), false);
  store.upload("alice", "audio/mpeg", TINY_BASE64);
  assert.equal(store.remove("alice"), true);
  assert.equal(store.get("alice"), undefined);
});

test("each author's background music is independent", () => {
  const store = new BackgroundMusicStore();
  store.upload("alice", "audio/mpeg", TINY_BASE64);
  assert.equal(store.get("bob"), undefined);
});
