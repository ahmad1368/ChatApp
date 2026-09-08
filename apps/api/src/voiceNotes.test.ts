import { test } from "node:test";
import assert from "node:assert/strict";
import { VoiceNoteStore } from "./voiceNotes";

const VALID_WAVEFORM = [0.1, 0.5, 0.9, 0.3];

test("save() rejects an unsupported mime type", () => {
  const store = new VoiceNoteStore();
  const result = store.save("video/mp4", Buffer.from("data").toString("base64"), VALID_WAVEFORM);
  assert.equal(result.success, false);
});

test("save() rejects an empty waveform", () => {
  const store = new VoiceNoteStore();
  const result = store.save("audio/webm", Buffer.from("data").toString("base64"), []);
  assert.equal(result.success, false);
});

test("save() rejects a waveform with an out-of-range point", () => {
  const store = new VoiceNoteStore();
  const result = store.save("audio/webm", Buffer.from("data").toString("base64"), [0.5, 1.5]);
  assert.equal(result.success, false);
});

test("save() rejects a non-numeric waveform entry", () => {
  const store = new VoiceNoteStore();
  const result = store.save("audio/webm", Buffer.from("data").toString("base64"), [0.5, "loud"]);
  assert.equal(result.success, false);
});

test("save() rejects a waveform over the max point count", () => {
  const store = new VoiceNoteStore();
  const result = store.save("audio/webm", Buffer.from("data").toString("base64"), new Array(201).fill(0.5));
  assert.equal(result.success, false);
});

test("save() rejects invalid base64 data", () => {
  const store = new VoiceNoteStore();
  const result = store.save("audio/webm", "", VALID_WAVEFORM);
  assert.equal(result.success, false);
});

test("save() rejects data over the 5MB limit", () => {
  const store = new VoiceNoteStore();
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64");
  const result = store.save("audio/webm", oversized, VALID_WAVEFORM);
  assert.equal(result.success, false);
});

test("save() accepts a valid voice note and returns an id and the waveform", () => {
  const store = new VoiceNoteStore();
  const result = store.save("audio/webm", Buffer.from("audio bytes").toString("base64"), VALID_WAVEFORM);
  assert.equal(result.success, true);
  if (result.success) {
    assert.ok(result.id.length > 0);
    assert.deepEqual(result.waveform, VALID_WAVEFORM);
  }
});

test("get() returns the stored note's mime type and bytes", () => {
  const store = new VoiceNoteStore();
  const saveResult = store.save("audio/ogg", Buffer.from("audio bytes").toString("base64"), VALID_WAVEFORM);
  assert.equal(saveResult.success, true);
  if (!saveResult.success) return;

  const note = store.get(saveResult.id);
  assert.equal(note?.mimeType, "audio/ogg");
  assert.equal(note?.data.toString(), "audio bytes");
});

test("get() returns undefined for an unknown id", () => {
  const store = new VoiceNoteStore();
  assert.equal(store.get("unknown"), undefined);
});
