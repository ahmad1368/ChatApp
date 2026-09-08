import { test } from "node:test";
import assert from "node:assert/strict";
import { canDeleteMessage, DELETE_WINDOW_MS } from "./messageDeletion";

function recentMessage(overrides: Partial<{ author: string; createdAt: string }> = {}) {
  return { author: "alice", createdAt: new Date().toISOString(), ...overrides };
}

test("canDeleteMessage() rejects a non-author", () => {
  const result = canDeleteMessage(recentMessage(), "bob");
  assert.deepEqual(result, { allowed: false, error: "Only the sender can delete this message" });
});

test("canDeleteMessage() allows the original sender within the window", () => {
  const result = canDeleteMessage(recentMessage(), "alice");
  assert.deepEqual(result, { allowed: true });
});

test("canDeleteMessage() rejects a message older than the delete window", () => {
  const oldMessage = recentMessage({ createdAt: new Date(Date.now() - DELETE_WINDOW_MS - 1000).toISOString() });
  const result = canDeleteMessage(oldMessage, "alice");
  assert.deepEqual(result, { allowed: false, error: "This message is too old to delete for everyone" });
});

test("canDeleteMessage() allows a message right at the edge of the window", () => {
  const now = Date.now();
  const edgeMessage = recentMessage({ createdAt: new Date(now - DELETE_WINDOW_MS).toISOString() });
  const result = canDeleteMessage(edgeMessage, "alice", now);
  assert.deepEqual(result, { allowed: true });
});
