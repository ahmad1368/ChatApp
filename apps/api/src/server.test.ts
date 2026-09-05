import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { ChatMessage } from "@chatapp/shared";
import { createChatServer } from "./server";
import { MessageStore } from "./rooms";

describe("chat API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createChatServer>;
  let store: MessageStore;

  before(async () => {
    store = new MessageStore();
    httpServer = createChatServer(store);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("reports healthy", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });

  it("returns an empty history for a room with no messages", async () => {
    const res = await fetch(`${baseUrl}/api/rooms/empty-room/messages`);
    assert.deepEqual(await res.json(), []);
  });

  it("returns full history, then only messages after `since` for reconnect sync", async () => {
    const older: ChatMessage = {
      id: "1",
      roomId: "room-a",
      author: "alice",
      text: "hi",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const newer: ChatMessage = {
      id: "2",
      roomId: "room-a",
      author: "bob",
      text: "hey",
      createdAt: "2026-01-01T00:01:00.000Z",
    };
    store.add("room-a", older);
    store.add("room-a", newer);

    const full = await fetch(`${baseUrl}/api/rooms/room-a/messages`).then((r) => r.json());
    assert.deepEqual(full, [older, newer]);

    const sinceOlder = await fetch(
      `${baseUrl}/api/rooms/room-a/messages?since=${encodeURIComponent(older.createdAt)}`
    ).then((r) => r.json());
    assert.deepEqual(sinceOlder, [newer]);
  });
});
