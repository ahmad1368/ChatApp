import { test } from "node:test";
import assert from "node:assert/strict";
import { IntroVideoStore } from "./introVideo";

const TINY_BASE64 = Buffer.from("not a real video, just bytes").toString("base64");

test("get() returns undefined before any upload", () => {
  const store = new IntroVideoStore();
  assert.equal(store.get("alice"), undefined);
});

test("upload() rejects a missing author", () => {
  const store = new IntroVideoStore();
  const result = store.upload("", "video/mp4", TINY_BASE64);
  assert.equal(result.success, false);
});

test("upload() rejects an unsupported mime type", () => {
  const store = new IntroVideoStore();
  const result = store.upload("alice", "video/avi", TINY_BASE64);
  assert.equal(result.success, false);
});

test("upload() rejects missing data", () => {
  const store = new IntroVideoStore();
  const result = store.upload("alice", "video/mp4", "");
  assert.equal(result.success, false);
});

test("upload() rejects a video over the size cap", () => {
  const store = new IntroVideoStore();
  const oversized = Buffer.alloc(21 * 1024 * 1024).toString("base64");
  const result = store.upload("alice", "video/mp4", oversized);
  assert.equal(result.success, false);
});

test("upload() accepts a valid video and get() returns it", () => {
  const store = new IntroVideoStore();
  const result = store.upload("alice", "video/mp4", TINY_BASE64);
  assert.equal(result.success, true);
  const stored = store.get("alice");
  assert.equal(stored?.mimeType, "video/mp4");
  assert.deepEqual(stored?.data, Buffer.from(TINY_BASE64, "base64"));
});

test("uploading again replaces the previous video for that author", () => {
  const store = new IntroVideoStore();
  store.upload("alice", "video/mp4", TINY_BASE64);
  const secondBase64 = Buffer.from("a different clip").toString("base64");
  store.upload("alice", "video/webm", secondBase64);
  const stored = store.get("alice");
  assert.equal(stored?.mimeType, "video/webm");
  assert.deepEqual(stored?.data, Buffer.from(secondBase64, "base64"));
});

test("remove() deletes the stored video and reports whether one existed", () => {
  const store = new IntroVideoStore();
  assert.equal(store.remove("alice"), false);
  store.upload("alice", "video/mp4", TINY_BASE64);
  assert.equal(store.remove("alice"), true);
  assert.equal(store.get("alice"), undefined);
});

test("each author's video is independent", () => {
  const store = new IntroVideoStore();
  store.upload("alice", "video/mp4", TINY_BASE64);
  assert.equal(store.get("bob"), undefined);
});
