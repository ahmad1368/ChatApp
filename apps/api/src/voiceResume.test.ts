import { test } from "node:test";
import assert from "node:assert/strict";
import { VoiceResumeStore } from "./voiceResume";

const TINY_BASE64 = Buffer.from("not a real audio clip, just bytes").toString("base64");

test("get() returns undefined before any upload", () => {
  const store = new VoiceResumeStore();
  assert.equal(store.get("alice"), undefined);
});

test("upload() rejects a missing author", () => {
  const store = new VoiceResumeStore();
  const result = store.upload("", "audio/webm", TINY_BASE64);
  assert.equal(result.success, false);
});

test("upload() rejects an unsupported mime type", () => {
  const store = new VoiceResumeStore();
  const result = store.upload("alice", "audio/x-wav", TINY_BASE64);
  assert.equal(result.success, false);
});

test("upload() rejects missing data", () => {
  const store = new VoiceResumeStore();
  const result = store.upload("alice", "audio/webm", "");
  assert.equal(result.success, false);
});

test("upload() rejects a clip over the size cap", () => {
  const store = new VoiceResumeStore();
  const oversized = Buffer.alloc(16 * 1024 * 1024).toString("base64");
  const result = store.upload("alice", "audio/webm", oversized);
  assert.equal(result.success, false);
});

test("upload() accepts a valid clip and get() returns it", () => {
  const store = new VoiceResumeStore();
  const result = store.upload("alice", "audio/webm", TINY_BASE64);
  assert.equal(result.success, true);
  const stored = store.get("alice");
  assert.equal(stored?.mimeType, "audio/webm");
  assert.deepEqual(stored?.data, Buffer.from(TINY_BASE64, "base64"));
});

test("uploading again replaces the previous clip for that author", () => {
  const store = new VoiceResumeStore();
  store.upload("alice", "audio/webm", TINY_BASE64);
  const secondBase64 = Buffer.from("a different recording").toString("base64");
  store.upload("alice", "audio/mp4", secondBase64);
  const stored = store.get("alice");
  assert.equal(stored?.mimeType, "audio/mp4");
  assert.deepEqual(stored?.data, Buffer.from(secondBase64, "base64"));
});

test("remove() deletes the stored clip and reports whether one existed", () => {
  const store = new VoiceResumeStore();
  assert.equal(store.remove("alice"), false);
  store.upload("alice", "audio/webm", TINY_BASE64);
  assert.equal(store.remove("alice"), true);
  assert.equal(store.get("alice"), undefined);
});

test("each author's voice resume is independent", () => {
  const store = new VoiceResumeStore();
  store.upload("alice", "audio/webm", TINY_BASE64);
  assert.equal(store.get("bob"), undefined);
});
