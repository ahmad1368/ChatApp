import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMessagePushPreview } from "./messagePushPreview";

test("returns the full text unchanged for the first message when short enough", () => {
  assert.equal(buildMessagePushPreview("Hey, how are you?", true), "Hey, how are you?");
});

test("truncates a long first message with an ellipsis", () => {
  const text = "x".repeat(120);
  const preview = buildMessagePushPreview(text, true);
  assert.ok(preview.endsWith("…"));
  assert.equal(preview.length, 81);
});

test("does not truncate a first message exactly at the limit", () => {
  const text = "x".repeat(80);
  assert.equal(buildMessagePushPreview(text, true), text);
});

test("trims trailing whitespace before appending the ellipsis", () => {
  const text = "word ".repeat(20);
  const preview = buildMessagePushPreview(text, true);
  assert.ok(!preview.slice(0, -1).endsWith(" "));
});

test("returns a generic message for anything after the first message from that sender", () => {
  assert.equal(buildMessagePushPreview("This is a private follow-up", false), "New message");
});

test("returns a generic message even for a short non-first message", () => {
  assert.equal(buildMessagePushPreview("hi", false), "New message");
});
