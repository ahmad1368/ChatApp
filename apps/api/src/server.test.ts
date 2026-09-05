import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { ChatMessage } from "@chatapp/shared";
import { createApp } from "./server";

function makeMessage(id: string, index: number): ChatMessage {
  return {
    id,
    roomId: "room-a",
    author: "alice",
    text: `message ${index}`,
    createdAt: new Date(2026, 0, 1, 0, index).toISOString(),
  };
}

describe("messages API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    const { app, messagesByRoom } = createApp();
    const seeded = Array.from({ length: 5 }, (_, i) => makeMessage(`m${i}`, i));
    messagesByRoom.set("room-a", seeded);

    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("returns the full history when no limit is given (backward compatible)", async () => {
    const res = await fetch(`${baseUrl}/api/rooms/room-a/messages`);
    const body = await res.json();
    assert.equal(body.length, 5);
    assert.equal(res.headers.get("x-has-more"), null);
  });

  it("returns the most recent page when limit is given with no cursor", async () => {
    const res = await fetch(`${baseUrl}/api/rooms/room-a/messages?limit=2`);
    const body: ChatMessage[] = await res.json();
    assert.deepEqual(body.map((m) => m.id), ["m3", "m4"]);
    assert.equal(res.headers.get("x-has-more"), "true");
  });

  it("pages backward using `before` and reports no more once exhausted", async () => {
    const res = await fetch(`${baseUrl}/api/rooms/room-a/messages?limit=2&before=m3`);
    const body: ChatMessage[] = await res.json();
    assert.deepEqual(body.map((m) => m.id), ["m1", "m2"]);
    assert.equal(res.headers.get("x-has-more"), "true");

    const res2 = await fetch(`${baseUrl}/api/rooms/room-a/messages?limit=2&before=m1`);
    const body2: ChatMessage[] = await res2.json();
    assert.deepEqual(body2.map((m) => m.id), ["m0"]);
    assert.equal(res2.headers.get("x-has-more"), "false");
  });

  it("caps limit at the configured maximum", async () => {
    const res = await fetch(`${baseUrl}/api/rooms/room-a/messages?limit=999`);
    const body: ChatMessage[] = await res.json();
    assert.equal(body.length, 5);
  });
});
