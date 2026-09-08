import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { Server as HttpServer } from "http";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { createChatServer } from "./server";

/**
 * Socket-level coverage for #121's "Instant text chat via WebSocket /
 * Socket.io" — the chat/message engine itself predates this issue (it's
 * the app's original core, not something #121 asked to build from
 * scratch), but until now it had only ever been exercised through
 * server.test.ts's REST message-history endpoints, never through an
 * actual socket.io connection. This file drives createChatServer() with
 * a real socket.io-client, the way ChatRoom.tsx's browser client does.
 */
async function startChatServer(): Promise<{ httpServer: HttpServer; baseUrl: string }> {
  const httpServer = await createChatServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  return { httpServer, baseUrl: `http://127.0.0.1:${port}` };
}

function connectClient(baseUrl: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, { transports: ["websocket"], reconnection: false });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function waitFor<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

// "join" has no server-side acknowledgment, so a client can't know when its
// join has actually been processed — a real race against a message sent
// from a different connection right after. A short settle delay avoids it
// here; production code has no such race since a single client always
// joins before it itself sends.
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

test("message:send broadcasts message:new to everyone joined in the same room", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  const listener = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    listener.emit("join", "room-1");
    await settle();

    const received = waitFor<{ author: string; text: string; roomId: string }>(listener, "message:new");
    sender.emit("message:send", { roomId: "room-1", author: "alice", text: "hello" });
    const message = await received;

    assert.equal(message.author, "alice");
    assert.equal(message.text, "hello");
    assert.equal(message.roomId, "room-1");
  } finally {
    sender.close();
    listener.close();
    httpServer.close();
  }
});

test("a client in a different room never receives the message", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  const bystander = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    bystander.emit("join", "room-2");
    await settle();

    let bystanderReceived = false;
    bystander.on("message:new", () => {
      bystanderReceived = true;
    });

    const senderSideEcho = waitFor(sender, "message:new");
    sender.emit("message:send", { roomId: "room-1", author: "alice", text: "hello" });
    await senderSideEcho;
    await settle();

    assert.equal(bystanderReceived, false);
  } finally {
    sender.close();
    bystander.close();
    httpServer.close();
  }
});

test("message:send is rejected with guest_mode for a guest-mode payload", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    const rejected = waitFor<{ reason?: string }>(client, "message:rejected");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "hello", asGuest: true });
    const payload = await rejected;
    assert.equal(payload.reason, "guest_mode");
  } finally {
    client.close();
    httpServer.close();
  }
});

test("message:send is rejected with scam_content for a scam phrase", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    const rejected = waitFor<{ reason?: string }>(client, "message:rejected");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "guaranteed return on your investment" });
    const payload = await rejected;
    assert.equal(payload.reason, "scam_content");
  } finally {
    client.close();
    httpServer.close();
  }
});

test("message:send is rejected with rate_limited after exceeding the per-connection send rate", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    // MESSAGE_RATE_LIMIT is 20 sends per 10s window in server.ts.
    for (let i = 0; i < 20; i++) {
      client.emit("message:send", { roomId: "room-1", author: "alice", text: `msg ${i}` });
    }
    const rejected = waitFor<{ reason?: string }>(client, "message:rejected");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "one too many" });
    const payload = await rejected;
    assert.equal(payload.reason, "rate_limited");
  } finally {
    client.close();
    httpServer.close();
  }
});

test("message:send carries a voice note's audioUrl and waveform through to message:new (#122)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  const listener = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    listener.emit("join", "room-1");
    await settle();

    const received = waitFor<{ audioUrl?: string; waveform?: number[] }>(listener, "message:new");
    sender.emit("message:send", {
      roomId: "room-1",
      author: "alice",
      text: "",
      audioUrl: "/api/voice-notes/abc123",
      waveform: [0.1, 0.5, 0.9],
    });
    const message = await received;

    assert.equal(message.audioUrl, "/api/voice-notes/abc123");
    assert.deepEqual(message.waveform, [0.1, 0.5, 0.9]);
  } finally {
    sender.close();
    listener.close();
    httpServer.close();
  }
});

test("message:send carries a self-destruct photo's URL through to message:new (#123)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  const listener = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    listener.emit("join", "room-1");
    await settle();

    const received = waitFor<{ selfDestructImageUrl?: string }>(listener, "message:new");
    sender.emit("message:send", {
      roomId: "room-1",
      author: "alice",
      text: "",
      selfDestructImageUrl: "/api/self-destruct-photos/abc123",
    });
    const message = await received;

    assert.equal(message.selfDestructImageUrl, "/api/self-destruct-photos/abc123");
  } finally {
    sender.close();
    listener.close();
    httpServer.close();
  }
});

test("message:delivered then message:read broadcast message:status to the room (#125)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  const recipient = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    recipient.emit("join", "room-1");
    await settle();

    const sent = waitFor<{ id: string }>(sender, "message:new");
    sender.emit("message:send", { roomId: "room-1", author: "alice", text: "hi" });
    const message = await sent;

    const deliveredStatus = waitFor<{ messageId: string; status: string }>(sender, "message:status");
    recipient.emit("message:delivered", { roomId: "room-1", messageId: message.id, author: "bob" });
    assert.deepEqual(await deliveredStatus, { messageId: message.id, status: "delivered" });

    const readStatus = waitFor<{ messageId: string; status: string }>(sender, "message:status");
    recipient.emit("message:read", { roomId: "room-1", messageId: message.id, author: "bob" });
    assert.deepEqual(await readStatus, { messageId: message.id, status: "read" });
  } finally {
    sender.close();
    recipient.close();
    httpServer.close();
  }
});

test("message:delivered from the message's own author is ignored", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    await settle();

    const sent = waitFor<{ id: string }>(sender, "message:new");
    sender.emit("message:send", { roomId: "room-1", author: "alice", text: "hi" });
    const message = await sent;

    let statusReceived = false;
    sender.on("message:status", () => {
      statusReceived = true;
    });
    sender.emit("message:delivered", { roomId: "room-1", messageId: message.id, author: "alice" });
    await settle();

    assert.equal(statusReceived, false);
  } finally {
    sender.close();
    httpServer.close();
  }
});
