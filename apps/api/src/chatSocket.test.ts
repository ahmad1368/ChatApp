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

test("typing:start broadcasts typing:update to others in the room, but not back to the typer (#126)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const typer = await connectClient(baseUrl);
  const listener = await connectClient(baseUrl);
  try {
    typer.emit("join", "room-1");
    listener.emit("join", "room-1");
    await settle();

    let typerReceived = false;
    typer.on("typing:update", () => {
      typerReceived = true;
    });
    const received = waitFor<{ roomId: string; authors: string[] }>(listener, "typing:update");
    typer.emit("typing:start", { roomId: "room-1", author: "alice" });
    const update = await received;

    assert.equal(update.roomId, "room-1");
    assert.deepEqual(update.authors, ["alice"]);
    assert.equal(typerReceived, false);
  } finally {
    typer.close();
    listener.close();
    httpServer.close();
  }
});

test("typing:stop removes the author from the broadcast typing:update", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const typer = await connectClient(baseUrl);
  const listener = await connectClient(baseUrl);
  try {
    typer.emit("join", "room-1");
    listener.emit("join", "room-1");
    await settle();

    const startUpdate = waitFor<{ authors: string[] }>(listener, "typing:update");
    typer.emit("typing:start", { roomId: "room-1", author: "alice" });
    await startUpdate;

    const stopUpdate = waitFor<{ authors: string[] }>(listener, "typing:update");
    typer.emit("typing:stop", { roomId: "room-1", author: "alice" });
    assert.deepEqual((await stopUpdate).authors, []);
  } finally {
    typer.close();
    listener.close();
    httpServer.close();
  }
});

test("disconnecting while typing clears the indicator for everyone else in the room", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const typer = await connectClient(baseUrl);
  const listener = await connectClient(baseUrl);
  try {
    typer.emit("join", "room-1");
    listener.emit("join", "room-1");
    await settle();

    const startUpdate = waitFor<{ authors: string[] }>(listener, "typing:update");
    typer.emit("typing:start", { roomId: "room-1", author: "alice" });
    await startUpdate;

    const clearedUpdate = waitFor<{ authors: string[] }>(listener, "typing:update");
    typer.close();
    assert.deepEqual((await clearedUpdate).authors, []);
  } finally {
    listener.close();
    httpServer.close();
  }
});

test("message:send with a live location share sets an authoritative expiresAt on message:new (#127)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    await settle();

    const received = waitFor<{ location?: { latitude: number; longitude: number; live: boolean; expiresAt?: string } }>(
      sender,
      "message:new"
    );
    sender.emit("message:send", {
      roomId: "room-1",
      author: "alice",
      text: "",
      location: { latitude: 40.7128, longitude: -74.006, live: true, durationMinutes: 15 },
    });
    const message = await received;

    assert.equal(message.location?.latitude, 40.7128);
    assert.equal(message.location?.live, true);
    assert.ok(message.location?.expiresAt && new Date(message.location.expiresAt).getTime() > Date.now());
  } finally {
    sender.close();
    httpServer.close();
  }
});

test("message:send rejects a live location share with an out-of-range duration", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    await settle();

    const rejected = waitFor<{ reason?: string }>(sender, "message:rejected");
    sender.emit("message:send", {
      roomId: "room-1",
      author: "alice",
      text: "",
      location: { latitude: 40.7128, longitude: -74.006, live: true, durationMinutes: 10_000 },
    });
    assert.equal((await rejected).reason, "invalid_location");
  } finally {
    sender.close();
    httpServer.close();
  }
});

test("location:update broadcasts new coordinates to the room", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  const listener = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    listener.emit("join", "room-1");
    await settle();

    const sent = waitFor<{ id: string }>(sender, "message:new");
    sender.emit("message:send", {
      roomId: "room-1",
      author: "alice",
      text: "",
      location: { latitude: 40.7128, longitude: -74.006, live: true, durationMinutes: 15 },
    });
    const message = await sent;

    const update = waitFor<{ messageId: string; latitude: number; longitude: number }>(listener, "location:update");
    sender.emit("location:update", { roomId: "room-1", messageId: message.id, author: "alice", latitude: 40.71, longitude: -74.0 });
    assert.deepEqual(await update, { messageId: message.id, latitude: 40.71, longitude: -74.0 });
  } finally {
    sender.close();
    listener.close();
    httpServer.close();
  }
});

test("location:update from someone other than the original sharer is rejected privately", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  const impostor = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    impostor.emit("join", "room-1");
    await settle();

    const sent = waitFor<{ id: string }>(sender, "message:new");
    sender.emit("message:send", {
      roomId: "room-1",
      author: "alice",
      text: "",
      location: { latitude: 40.7128, longitude: -74.006, live: true, durationMinutes: 15 },
    });
    const message = await sent;

    const rejected = waitFor<{ messageId: string; error: string }>(impostor, "location:rejected");
    impostor.emit("location:update", { roomId: "room-1", messageId: message.id, author: "bob", latitude: 40.71, longitude: -74.0 });
    const payload = await rejected;
    assert.equal(payload.messageId, message.id);
  } finally {
    sender.close();
    impostor.close();
    httpServer.close();
  }
});

test("call:invite broadcasts call:incoming, call:accept broadcasts call:accepted (#128)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const caller = await connectClient(baseUrl);
  const callee = await connectClient(baseUrl);
  try {
    caller.emit("join", "room-1");
    callee.emit("join", "room-1");
    await settle();

    const incoming = waitFor<{ id: string; caller: string; callee: string; status: string }>(callee, "call:incoming");
    caller.emit("call:invite", { roomId: "room-1", caller: "alice", callee: "bob" });
    const call = await incoming;
    assert.equal(call.caller, "alice");
    assert.equal(call.callee, "bob");
    assert.equal(call.status, "ringing");

    const accepted = waitFor<{ id: string; status: string }>(caller, "call:accepted");
    callee.emit("call:accept", { callId: call.id, author: "bob" });
    assert.equal((await accepted).status, "active");
  } finally {
    caller.close();
    callee.close();
    httpServer.close();
  }
});

test("call:invite with video:true carries the video flag through to call:incoming (#129)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const caller = await connectClient(baseUrl);
  const callee = await connectClient(baseUrl);
  try {
    caller.emit("join", "room-1");
    callee.emit("join", "room-1");
    await settle();

    const incoming = waitFor<{ video: boolean }>(callee, "call:incoming");
    caller.emit("call:invite", { roomId: "room-1", caller: "alice", callee: "bob", video: true });
    assert.equal((await incoming).video, true);
  } finally {
    caller.close();
    callee.close();
    httpServer.close();
  }
});

test("call:invite without video defaults to an audio call", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const caller = await connectClient(baseUrl);
  const callee = await connectClient(baseUrl);
  try {
    caller.emit("join", "room-1");
    callee.emit("join", "room-1");
    await settle();

    const incoming = waitFor<{ video: boolean }>(callee, "call:incoming");
    caller.emit("call:invite", { roomId: "room-1", caller: "alice", callee: "bob" });
    assert.equal((await incoming).video, false);
  } finally {
    caller.close();
    callee.close();
    httpServer.close();
  }
});

test("call:invite is rejected when the callee is already in a call", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const caller = await connectClient(baseUrl);
  const callee = await connectClient(baseUrl);
  const thirdParty = await connectClient(baseUrl);
  try {
    caller.emit("join", "room-1");
    callee.emit("join", "room-1");
    thirdParty.emit("join", "room-1");
    await settle();

    const firstIncoming = waitFor(callee, "call:incoming");
    caller.emit("call:invite", { roomId: "room-1", caller: "alice", callee: "bob" });
    await firstIncoming;

    const rejected = waitFor<{ reason: string }>(thirdParty, "call:rejected");
    thirdParty.emit("call:invite", { roomId: "room-1", caller: "carol", callee: "bob" });
    assert.equal((await rejected).reason, "This person is already in a call");
  } finally {
    caller.close();
    callee.close();
    thirdParty.close();
    httpServer.close();
  }
});

test("call:end broadcasts call:ended to the room", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const caller = await connectClient(baseUrl);
  const callee = await connectClient(baseUrl);
  try {
    caller.emit("join", "room-1");
    callee.emit("join", "room-1");
    await settle();

    const incoming = waitFor<{ id: string }>(callee, "call:incoming");
    caller.emit("call:invite", { roomId: "room-1", caller: "alice", callee: "bob" });
    const call = await incoming;

    const ended = waitFor<{ callId: string; endedBy: string }>(callee, "call:ended");
    caller.emit("call:end", { callId: call.id, author: "alice" });
    assert.deepEqual(await ended, { callId: call.id, endedBy: "alice" });
  } finally {
    caller.close();
    callee.close();
    httpServer.close();
  }
});

test("call:signal relays an opaque WebRTC payload to the room", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const caller = await connectClient(baseUrl);
  const callee = await connectClient(baseUrl);
  try {
    caller.emit("join", "room-1");
    callee.emit("join", "room-1");
    await settle();

    const incoming = waitFor<{ id: string }>(callee, "call:incoming");
    caller.emit("call:invite", { roomId: "room-1", caller: "alice", callee: "bob" });
    const call = await incoming;

    const signal = waitFor<{ callId: string; from: string; to: string; data: unknown }>(callee, "call:signal");
    caller.emit("call:signal", { callId: call.id, roomId: "room-1", from: "alice", to: "bob", data: { type: "offer", sdp: "fake-sdp" } });
    assert.deepEqual(await signal, { callId: call.id, from: "alice", to: "bob", data: { type: "offer", sdp: "fake-sdp" } });
  } finally {
    caller.close();
    callee.close();
    httpServer.close();
  }
});
