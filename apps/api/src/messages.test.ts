import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildChatMessage } from "./messages";

describe("buildChatMessage", () => {
  it("generates an id and timestamp and defaults the room", () => {
    const message = buildChatMessage({ roomId: "", author: "alice", text: "hi" });
    assert.equal(message.roomId, "general");
    assert.equal(message.author, "alice");
    assert.equal(message.text, "hi");
    assert.ok(message.id.length > 0);
    assert.ok(!Number.isNaN(Date.parse(message.createdAt)));
  });

  it("carries reply-to metadata through when provided", () => {
    const message = buildChatMessage({
      roomId: "room-a",
      author: "bob",
      text: "sure thing",
      replyToId: "m1",
      replyToAuthor: "alice",
      replyToText: "can you send that file?",
    });
    assert.equal(message.replyToId, "m1");
    assert.equal(message.replyToAuthor, "alice");
    assert.equal(message.replyToText, "can you send that file?");
  });

  it("leaves reply-to fields undefined when not replying", () => {
    const message = buildChatMessage({ roomId: "room-a", author: "bob", text: "hello" });
    assert.equal(message.replyToId, undefined);
    assert.equal(message.replyToAuthor, undefined);
    assert.equal(message.replyToText, undefined);
  });
});
