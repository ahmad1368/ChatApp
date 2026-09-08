import { test } from "node:test";
import assert from "node:assert/strict";
import { canEditMessage, EDIT_WINDOW_MS } from "./messageEditing";

function recentMessage(overrides: Partial<{ author: string; createdAt: string }> = {}) {
  return { author: "alice", createdAt: new Date().toISOString(), ...overrides };
}

test("canEditMessage() rejects a non-author", () => {
  const result = canEditMessage(recentMessage(), "bob");
  assert.deepEqual(result, { allowed: false, error: "Only the sender can edit this message" });
});

test("canEditMessage() allows the original sender within the window", () => {
  const result = canEditMessage(recentMessage(), "alice");
  assert.deepEqual(result, { allowed: true });
});

test("canEditMessage() rejects a message older than the edit window", () => {
  const oldMessage = recentMessage({ createdAt: new Date(Date.now() - EDIT_WINDOW_MS - 1000).toISOString() });
  const result = canEditMessage(oldMessage, "alice");
  assert.deepEqual(result, { allowed: false, error: "This message is too old to edit" });
});

test("canEditMessage() allows a message right at the edge of the window", () => {
  const now = Date.now();
  const edgeMessage = recentMessage({ createdAt: new Date(now - EDIT_WINDOW_MS).toISOString() });
  const result = canEditMessage(edgeMessage, "alice", now);
  assert.deepEqual(result, { allowed: true });
});

test("canEditMessage() rejects an image message", () => {
  const result = canEditMessage({ ...recentMessage(), imageUrl: "/api/uploads/1" }, "alice");
  assert.deepEqual(result, { allowed: false, error: "Only text messages can be edited" });
});

test("canEditMessage() rejects a voice note message", () => {
  const result = canEditMessage({ ...recentMessage(), audioUrl: "/api/voice-notes/1" }, "alice");
  assert.deepEqual(result, { allowed: false, error: "Only text messages can be edited" });
});

test("canEditMessage() rejects a self-destruct photo message", () => {
  const result = canEditMessage({ ...recentMessage(), selfDestructImageUrl: "/api/self-destruct-photos/1" }, "alice");
  assert.deepEqual(result, { allowed: false, error: "Only text messages can be edited" });
});

test("canEditMessage() rejects a location share message", () => {
  const result = canEditMessage({ ...recentMessage(), location: { latitude: 0, longitude: 0, live: false } }, "alice");
  assert.deepEqual(result, { allowed: false, error: "Only text messages can be edited" });
});

test("canEditMessage() checks authorship before the media-type restriction", () => {
  const result = canEditMessage({ ...recentMessage(), imageUrl: "/api/uploads/1" }, "bob");
  assert.deepEqual(result, { allowed: false, error: "Only the sender can edit this message" });
});
