import { test } from "node:test";
import assert from "node:assert/strict";
import { ChatMessage } from "@chatapp/shared";
import { exportDataForAuthor } from "./dataExport";

function makeMessage(author: string, id: string, createdAt: string): ChatMessage {
  return { id, roomId: "general", author, text: `msg-${id}`, createdAt };
}

test("exportDataForAuthor() collects only that author's messages, across all rooms", () => {
  const messagesByRoom = new Map<string, ChatMessage[]>([
    ["general", [makeMessage("alice", "1", "2024-01-01T00:00:00.000Z"), makeMessage("bob", "2", "2024-01-01T00:00:01.000Z")]],
    ["random", [makeMessage("alice", "3", "2024-01-01T00:00:02.000Z")]],
  ]);

  const result = exportDataForAuthor(messagesByRoom, "alice");

  assert.equal(result.author, "alice");
  assert.deepEqual(
    result.messages.map((m) => m.id),
    ["1", "3"]
  );
});

test("exportDataForAuthor() orders messages chronologically regardless of room order", () => {
  const messagesByRoom = new Map<string, ChatMessage[]>([
    ["general", [makeMessage("alice", "later", "2024-01-02T00:00:00.000Z")]],
    ["random", [makeMessage("alice", "earlier", "2024-01-01T00:00:00.000Z")]],
  ]);

  const result = exportDataForAuthor(messagesByRoom, "alice");

  assert.deepEqual(
    result.messages.map((m) => m.id),
    ["earlier", "later"]
  );
});

test("exportDataForAuthor() returns an empty list for an author with no data", () => {
  const messagesByRoom = new Map<string, ChatMessage[]>([["general", [makeMessage("bob", "1", "2024-01-01T00:00:00.000Z")]]]);
  const result = exportDataForAuthor(messagesByRoom, "alice");
  assert.deepEqual(result.messages, []);
});
