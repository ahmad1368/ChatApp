import { test } from "node:test";
import assert from "node:assert/strict";
import { ChatMessage } from "@chatapp/shared";
import { AccountDeletionCoordinator, deleteMessagesForAuthor } from "./accountDeletion";

function makeMessage(author: string, id: string): ChatMessage {
  return { id, roomId: "general", author, text: "hi", createdAt: new Date().toISOString() };
}

test("deleteMessagesForAuthor() removes only that author's messages, across all rooms", () => {
  const messagesByRoom = new Map<string, ChatMessage[]>([
    ["general", [makeMessage("alice", "1"), makeMessage("bob", "2")]],
    ["random", [makeMessage("alice", "3")]],
  ]);

  const deleted = deleteMessagesForAuthor(messagesByRoom, "alice");

  assert.equal(deleted, 2);
  assert.deepEqual(
    messagesByRoom.get("general")?.map((m) => m.id),
    ["2"]
  );
  assert.deepEqual(messagesByRoom.get("random"), []);
});

test("deleteMessagesForAuthor() returns 0 when the author has no messages", () => {
  const messagesByRoom = new Map<string, ChatMessage[]>([["general", [makeMessage("bob", "1")]]]);
  assert.equal(deleteMessagesForAuthor(messagesByRoom, "alice"), 0);
});

test("AccountDeletionCoordinator sums results across every registered purger", () => {
  const coordinator = new AccountDeletionCoordinator();
  coordinator.register((author) => (author === "alice" ? 3 : 0));
  coordinator.register((author) => (author === "alice" ? 2 : 0));

  assert.deepEqual(coordinator.deleteAllDataFor("alice"), { deletedRecordCount: 5 });
  assert.deepEqual(coordinator.deleteAllDataFor("bob"), { deletedRecordCount: 0 });
});

test("AccountDeletionCoordinator with no registered purgers deletes nothing", () => {
  const coordinator = new AccountDeletionCoordinator();
  assert.deepEqual(coordinator.deleteAllDataFor("alice"), { deletedRecordCount: 0 });
});
