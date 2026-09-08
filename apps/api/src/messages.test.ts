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

  it("carries image and reply-to metadata through when provided", () => {
    const message = buildChatMessage({
      roomId: "room-a",
      author: "bob",
      text: "sure thing",
      imageUrl: "/api/uploads/abc123",
      replyToId: "m1",
      replyToAuthor: "alice",
      replyToText: "can you send that file?",
    });
    assert.equal(message.imageUrl, "/api/uploads/abc123");
    assert.equal(message.replyToId, "m1");
    assert.equal(message.replyToAuthor, "alice");
    assert.equal(message.replyToText, "can you send that file?");
  });

  it("leaves image and reply-to fields undefined when not provided", () => {
    const message = buildChatMessage({ roomId: "room-a", author: "bob", text: "hello" });
    assert.equal(message.imageUrl, undefined);
    assert.equal(message.replyToId, undefined);
    assert.equal(message.replyToAuthor, undefined);
    assert.equal(message.replyToText, undefined);
  });

  it("carries a voice note's audioUrl and waveform through when provided (#122)", () => {
    const message = buildChatMessage({
      roomId: "room-a",
      author: "bob",
      text: "",
      audioUrl: "/api/voice-notes/abc123",
      waveform: [0.1, 0.5, 0.9],
    });
    assert.equal(message.audioUrl, "/api/voice-notes/abc123");
    assert.deepEqual(message.waveform, [0.1, 0.5, 0.9]);
  });

  it("leaves audioUrl and waveform undefined when not provided", () => {
    const message = buildChatMessage({ roomId: "room-a", author: "bob", text: "hello" });
    assert.equal(message.audioUrl, undefined);
    assert.equal(message.waveform, undefined);
  });

  it("carries a self-destruct photo's URL through when provided (#123)", () => {
    const message = buildChatMessage({
      roomId: "room-a",
      author: "bob",
      text: "",
      selfDestructImageUrl: "/api/self-destruct-photos/abc123",
    });
    assert.equal(message.selfDestructImageUrl, "/api/self-destruct-photos/abc123");
  });

  it("leaves selfDestructImageUrl undefined when not provided", () => {
    const message = buildChatMessage({ roomId: "room-a", author: "bob", text: "hello" });
    assert.equal(message.selfDestructImageUrl, undefined);
  });

  it("carries a location share through when provided (#127)", () => {
    const message = buildChatMessage({
      roomId: "room-a",
      author: "bob",
      text: "",
      location: { latitude: 40.7128, longitude: -74.006, label: "Central Park", live: false },
    });
    assert.deepEqual(message.location, { latitude: 40.7128, longitude: -74.006, label: "Central Park", live: false });
  });

  it("leaves location undefined when not provided", () => {
    const message = buildChatMessage({ roomId: "room-a", author: "bob", text: "hello" });
    assert.equal(message.location, undefined);
  });
});
