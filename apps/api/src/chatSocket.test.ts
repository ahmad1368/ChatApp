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

test("message:send is rejected with bank_card_number for a valid card number (#318)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    const rejected = waitFor<{ reason?: string }>(client, "message:rejected");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "here's my card 4111 1111 1111 1111" });
    const payload = await rejected;
    assert.equal(payload.reason, "bank_card_number");
  } finally {
    client.close();
    httpServer.close();
  }
});

test("message:send delivers ordinary text with a long non-card digit run (#318)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    const received = waitFor<{ text: string }>(client, "message:new");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "my tracking number is 1Z999AA10123456784" });
    const message = await received;
    assert.equal(message.text, "my tracking number is 1Z999AA10123456784");
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

test("Ban/Shadowban (#175): message:send is rejected with banned for a banned author, but a shadowbanned author still sends normally", async () => {
  const previous = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = "test-admin-secret";
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    await fetch(`${baseUrl}/api/admin/bans/alice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": "test-admin-secret" },
      body: JSON.stringify({ mode: "banned", type: "permanent", reason: "harassment", bannedBy: "admin" }),
    });
    await fetch(`${baseUrl}/api/admin/bans/bob`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": "test-admin-secret" },
      body: JSON.stringify({ mode: "shadowbanned", reason: "fake profile", bannedBy: "admin" }),
    });

    client.emit("join", "room-1");
    const rejected = waitFor<{ reason?: string }>(client, "message:rejected");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "hello" });
    const payload = await rejected;
    assert.equal(payload.reason, "banned");

    const delivered = waitFor<{ author: string }>(client, "message:new");
    client.emit("message:send", { roomId: "room-1", author: "bob", text: "hi from bob" });
    const message = await delivered;
    assert.equal(message.author, "bob");
  } finally {
    client.close();
    httpServer.close();
    if (previous === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = previous;
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
    // #130's video-call gate requires MIN_MESSAGES_BEFORE_VIDEO_CALL
    // messages exchanged first.
    for (let i = 0; i < 10; i++) {
      caller.emit("message:send", { roomId: "room-1", author: "alice", text: `msg ${i}` });
    }
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

test("call:invite with video:true is rejected before 10 messages are exchanged (#130)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const caller = await connectClient(baseUrl);
  const callee = await connectClient(baseUrl);
  try {
    caller.emit("join", "room-1");
    callee.emit("join", "room-1");
    await settle();

    const rejected = waitFor<{ reason: string }>(caller, "call:rejected");
    caller.emit("call:invite", { roomId: "room-1", caller: "alice", callee: "bob", video: true });
    const payload = await rejected;
    assert.match(payload.reason, /more message/i);
  } finally {
    caller.close();
    callee.close();
    httpServer.close();
  }
});

test("call:invite with video:true is allowed once 10 messages have been exchanged", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const caller = await connectClient(baseUrl);
  const callee = await connectClient(baseUrl);
  try {
    caller.emit("join", "room-1");
    callee.emit("join", "room-1");
    await settle();
    for (let i = 0; i < 10; i++) {
      caller.emit("message:send", { roomId: "room-1", author: "alice", text: `msg ${i}` });
    }
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

test("call:invite without video is never gated by the message count", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const caller = await connectClient(baseUrl);
  const callee = await connectClient(baseUrl);
  try {
    caller.emit("join", "room-1");
    callee.emit("join", "room-1");
    await settle();

    const incoming = waitFor<{ video: boolean }>(callee, "call:incoming");
    caller.emit("call:invite", { roomId: "room-1", caller: "alice", callee: "bob", video: false });
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

test("call:caption relays transcribed text to the room only once the call is active (#246)", async () => {
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

    // Not active yet (still ringing) — the caption is dropped.
    let receivedTooEarly = false;
    callee.once("call:caption", () => {
      receivedTooEarly = true;
    });
    caller.emit("call:caption", { callId: call.id, roomId: "room-1", from: "alice", to: "bob", text: "hello there" });
    await settle();
    assert.equal(receivedTooEarly, false);

    const accepted = waitFor<{ id: string }>(caller, "call:accepted");
    callee.emit("call:accept", { callId: call.id, author: "bob" });
    await accepted;

    const caption = waitFor<{ callId: string; from: string; to: string; text: string }>(callee, "call:caption");
    caller.emit("call:caption", { callId: call.id, roomId: "room-1", from: "alice", to: "bob", text: "hello there" });
    assert.deepEqual(await caption, { callId: call.id, from: "alice", to: "bob", text: "hello there" });
  } finally {
    caller.close();
    callee.close();
    httpServer.close();
  }
});

test("call:caption drops an empty transcript", async () => {
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

    const accepted = waitFor<{ id: string }>(caller, "call:accepted");
    callee.emit("call:accept", { callId: call.id, author: "bob" });
    await accepted;

    let received = false;
    callee.once("call:caption", () => {
      received = true;
    });
    caller.emit("call:caption", { callId: call.id, roomId: "room-1", from: "alice", to: "bob", text: "   " });
    await settle();
    assert.equal(received, false);
  } finally {
    caller.close();
    callee.close();
    httpServer.close();
  }
});

test("message:edit updates the text and broadcasts message:edited (#133)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  const listener = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    listener.emit("join", "room-1");
    await settle();

    const sent = waitFor<{ id: string }>(sender, "message:new");
    sender.emit("message:send", { roomId: "room-1", author: "alice", text: "hello" });
    const message = await sent;

    const edited = waitFor<{ messageId: string; text: string; edited: boolean }>(listener, "message:edited");
    sender.emit("message:edit", { roomId: "room-1", messageId: message.id, author: "alice", text: "hello there" });
    assert.deepEqual(await edited, { messageId: message.id, text: "hello there", edited: true });
  } finally {
    sender.close();
    listener.close();
    httpServer.close();
  }
});

test("message:edit is rejected for a non-sender", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  const impostor = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    impostor.emit("join", "room-1");
    await settle();

    const sent = waitFor<{ id: string }>(sender, "message:new");
    sender.emit("message:send", { roomId: "room-1", author: "alice", text: "hello" });
    const message = await sent;

    const rejected = waitFor<{ messageId: string; error: string }>(impostor, "message:edit-rejected");
    impostor.emit("message:edit", { roomId: "room-1", messageId: message.id, author: "bob", text: "hacked" });
    const payload = await rejected;
    assert.equal(payload.error, "Only the sender can edit this message");
  } finally {
    sender.close();
    impostor.close();
    httpServer.close();
  }
});

test("message:edit is rejected for an image message", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    await settle();

    const sent = waitFor<{ id: string }>(sender, "message:new");
    sender.emit("message:send", { roomId: "room-1", author: "alice", text: "", imageUrl: "/api/uploads/abc" });
    const message = await sent;

    const rejected = waitFor<{ messageId: string; error: string }>(sender, "message:edit-rejected");
    sender.emit("message:edit", { roomId: "room-1", messageId: message.id, author: "alice", text: "new caption" });
    const payload = await rejected;
    assert.equal(payload.error, "Only text messages can be edited");
  } finally {
    sender.close();
    httpServer.close();
  }
});

test("message:edit is rejected with a scam phrase, same as a fresh send", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    await settle();

    const sent = waitFor<{ id: string }>(sender, "message:new");
    sender.emit("message:send", { roomId: "room-1", author: "alice", text: "hello" });
    const message = await sent;

    const rejected = waitFor<{ messageId: string; error: string }>(sender, "message:edit-rejected");
    sender.emit("message:edit", { roomId: "room-1", messageId: message.id, author: "alice", text: "guaranteed return on your investment" });
    const payload = await rejected;
    assert.match(payload.error, /scam/i);
  } finally {
    sender.close();
    httpServer.close();
  }
});

test("message:delete clears the message and broadcasts message:deleted (#134)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  const listener = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    listener.emit("join", "room-1");
    await settle();

    const sent = waitFor<{ id: string }>(sender, "message:new");
    sender.emit("message:send", { roomId: "room-1", author: "alice", text: "oops" });
    const message = await sent;

    const deleted = waitFor<{ messageId: string }>(listener, "message:deleted");
    sender.emit("message:delete", { roomId: "room-1", messageId: message.id, author: "alice" });
    assert.deepEqual(await deleted, { messageId: message.id });
  } finally {
    sender.close();
    listener.close();
    httpServer.close();
  }
});

test("message:delete clears media fields too", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    await settle();

    const sent = waitFor<{ id: string }>(sender, "message:new");
    sender.emit("message:send", { roomId: "room-1", author: "alice", text: "", imageUrl: "/api/uploads/abc" });
    const message = await sent;

    sender.emit("message:delete", { roomId: "room-1", messageId: message.id, author: "alice" });
    await settle();

    const historyRes = await fetch(`${baseUrl}/api/rooms/room-1/messages`);
    const history = await historyRes.json();
    const stored = history.find((m: { id: string }) => m.id === message.id);
    assert.equal(stored.imageUrl, undefined);
    assert.equal(stored.deleted, true);
  } finally {
    sender.close();
    httpServer.close();
  }
});

test("message:delete is rejected for a non-sender", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const sender = await connectClient(baseUrl);
  const impostor = await connectClient(baseUrl);
  try {
    sender.emit("join", "room-1");
    impostor.emit("join", "room-1");
    await settle();

    const sent = waitFor<{ id: string }>(sender, "message:new");
    sender.emit("message:send", { roomId: "room-1", author: "alice", text: "hello" });
    const message = await sent;

    const rejected = waitFor<{ messageId: string; error: string }>(impostor, "message:delete-rejected");
    impostor.emit("message:delete", { roomId: "room-1", messageId: message.id, author: "bob" });
    const payload = await rejected;
    assert.equal(payload.error, "Only the sender can delete this message");
  } finally {
    sender.close();
    impostor.close();
    httpServer.close();
  }
});

async function setGender(baseUrl: string, author: string, gender: string) {
  await fetch(`${baseUrl}/api/gender-info/${encodeURIComponent(author)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gender }),
  });
}

test("message:send blocks a man from sending the first message to a woman (#135)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const man = await connectClient(baseUrl);
  try {
    man.emit("join", "room-1");
    await settle();
    await setGender(baseUrl, "bob", "man");
    await setGender(baseUrl, "alice", "woman");

    const rejected = waitFor<{ reason: string; error: string }>(man, "message:rejected");
    man.emit("message:send", { roomId: "room-1", author: "bob", text: "hey", recipient: "alice" });
    const payload = await rejected;
    assert.equal(payload.reason, "first_message_gender_rule");
  } finally {
    man.close();
    httpServer.close();
  }
});

test("message:send allows a woman to send the first message to a man", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const woman = await connectClient(baseUrl);
  try {
    woman.emit("join", "room-1");
    await settle();
    await setGender(baseUrl, "bob", "man");
    await setGender(baseUrl, "alice", "woman");

    const sent = waitFor<{ id: string }>(woman, "message:new");
    woman.emit("message:send", { roomId: "room-1", author: "alice", text: "hey", recipient: "bob" });
    await sent;
  } finally {
    woman.close();
    httpServer.close();
  }
});

test("message:send allows either side in a same-gender match", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    await settle();
    await setGender(baseUrl, "bob", "man");
    await setGender(baseUrl, "carl", "man");

    const sent = waitFor<{ id: string }>(client, "message:new");
    client.emit("message:send", { roomId: "room-1", author: "bob", text: "hey", recipient: "carl" });
    await sent;
  } finally {
    client.close();
    httpServer.close();
  }
});

test("message:send skips the gender rule once a conversation is already underway", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const man = await connectClient(baseUrl);
  const woman = await connectClient(baseUrl);
  try {
    man.emit("join", "room-1");
    woman.emit("join", "room-1");
    await settle();
    await setGender(baseUrl, "bob", "man");
    await setGender(baseUrl, "alice", "woman");

    const firstSent = waitFor<{ id: string }>(man, "message:new");
    woman.emit("message:send", { roomId: "room-1", author: "alice", text: "hi", recipient: "bob" });
    await firstSent;

    const secondSent = waitFor<{ id: string }>(man, "message:new");
    man.emit("message:send", { roomId: "room-1", author: "bob", text: "hey back", recipient: "alice" });
    await secondSent;
  } finally {
    man.close();
    woman.close();
    httpServer.close();
  }
});

test("message:send skips the gender rule when recipient is omitted", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const man = await connectClient(baseUrl);
  try {
    man.emit("join", "room-1");
    await settle();
    await setGender(baseUrl, "bob", "man");
    await setGender(baseUrl, "alice", "woman");

    const sent = waitFor<{ id: string }>(man, "message:new");
    man.emit("message:send", { roomId: "room-1", author: "bob", text: "hey" });
    await sent;
  } finally {
    man.close();
    httpServer.close();
  }
});

test("message:send with a recipient works end-to-end after a real match (#136)", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    await settle();

    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "like" }),
    });
    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "bob", swiped: "alice", direction: "like" }),
    });

    const sent = waitFor<{ id: string }>(client, "message:new");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "hey", recipient: "bob" });
    await sent;

    const expiryRes = await fetch(`${baseUrl}/api/matches/alice/bob/expiry`);
    const expiry = await expiryRes.json();
    assert.ok(expiry.firstMessageSentAt);
    assert.equal(expiry.expired, false);
  } finally {
    client.close();
    httpServer.close();
  }
});

test("GET /api/admin/server-health (#186) requires the admin key and reports a live socket count", async () => {
  const previous = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = "test-admin-secret";
  const { httpServer, baseUrl } = await startChatServer();
  try {
    const noKeyRes = await fetch(`${baseUrl}/api/admin/server-health`);
    assert.equal(noKeyRes.status, 401);

    const beforeRes = await fetch(`${baseUrl}/api/admin/server-health`, { headers: { "x-admin-key": "test-admin-secret" } });
    const before = await beforeRes.json();
    assert.equal(beforeRes.status, 200);
    assert.equal(before.activeSockets, 0);
    assert.equal(typeof before.uptimeSeconds, "number");
    assert.equal(typeof before.memory.heapUsed, "number");

    const clientA = await connectClient(baseUrl);
    const clientB = await connectClient(baseUrl);
    try {
      const afterRes = await fetch(`${baseUrl}/api/admin/server-health`, { headers: { "x-admin-key": "test-admin-secret" } });
      const after = await afterRes.json();
      assert.equal(after.activeSockets, 2);
    } finally {
      clientA.close();
      clientB.close();
    }
  } finally {
    httpServer.close();
    if (previous === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = previous;
  }
});

test("Virtual gifts (#197): message:send is rejected with invalid_gift for an unknown giftId", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    const rejected = waitFor<{ reason?: string }>(client, "message:rejected");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "", giftId: "not-a-real-gift" });
    const payload = await rejected;
    assert.equal(payload.reason, "invalid_gift");
  } finally {
    client.close();
    httpServer.close();
  }
});

test("Virtual gifts (#197): message:send is rejected with insufficient_coins when the sender hasn't bought any", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    const rejected = waitFor<{ reason?: string }>(client, "message:rejected");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "", giftId: "rose" });
    const payload = await rejected;
    assert.equal(payload.reason, "insufficient_coins");
  } finally {
    client.close();
    httpServer.close();
  }
});

test("Virtual gifts (#197): a sender with enough coins can send a gift, which debits the balance and carries the real cost/emoji", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    await fetch(`${baseUrl}/api/coins/alice/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: "small" }),
    });

    client.emit("join", "room-1");
    const received = waitFor<{ gift?: { id: string; cost: number; emoji: string }; text: string }>(client, "message:new");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "", giftId: "rose" });
    const message = await received;

    assert.equal(message.gift?.id, "rose");
    assert.equal(message.gift?.cost, 20);
    assert.ok(message.text.includes(message.gift?.emoji ?? ""));

    const balanceRes = await fetch(`${baseUrl}/api/coins/alice`);
    assert.equal((await balanceRes.json()).balance, 80);
  } finally {
    client.close();
    httpServer.close();
  }
});

test("Cafe gift cards (#330): message:send is rejected with invalid_gift_card_amount for an amount not in the catalog", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    const rejected = waitFor<{ reason?: string }>(client, "message:rejected");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "", recipient: "bob", cafeGiftCardAmount: 7 });
    const payload = await rejected;
    assert.equal(payload.reason, "invalid_gift_card_amount");
  } finally {
    client.close();
    httpServer.close();
  }
});

test("Cafe gift cards (#330): message:send is rejected with gift_card_requires_recipient when no recipient is given", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    const rejected = waitFor<{ reason?: string }>(client, "message:rejected");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "", cafeGiftCardAmount: 5 });
    const payload = await rejected;
    assert.equal(payload.reason, "gift_card_requires_recipient");
  } finally {
    client.close();
    httpServer.close();
  }
});

test("Cafe gift cards (#330): message:send is rejected with insufficient_coins when the sender hasn't bought any", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");
    const rejected = waitFor<{ reason?: string }>(client, "message:rejected");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "", recipient: "bob", cafeGiftCardAmount: 5 });
    const payload = await rejected;
    assert.equal(payload.reason, "insufficient_coins");
  } finally {
    client.close();
    httpServer.close();
  }
});

test("Cafe gift cards (#330): a sender with enough coins can send one, which debits the balance and carries a real code", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    await fetch(`${baseUrl}/api/coins/alice/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: "medium" }),
    });

    client.emit("join", "room-1");
    const received = waitFor<{ cafeGiftCard?: { id: string; amountDollars: number; code: string; redeemed: boolean }; text: string }>(
      client,
      "message:new"
    );
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "", recipient: "bob", cafeGiftCardAmount: 5 });
    const message = await received;

    assert.equal(message.cafeGiftCard?.amountDollars, 5);
    assert.equal(message.cafeGiftCard?.redeemed, false);
    assert.match(message.cafeGiftCard?.code ?? "", /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    assert.ok(message.text.includes("$5"));

    const balanceRes = await fetch(`${baseUrl}/api/coins/alice`);
    assert.equal((await balanceRes.json()).balance, 50);
  } finally {
    client.close();
    httpServer.close();
  }
});

test("Cafe gift cards (#330): only the recipient can redeem it, and only once", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    await fetch(`${baseUrl}/api/coins/alice/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: "medium" }),
    });

    client.emit("join", "room-1");
    const received = waitFor<{ id: string; cafeGiftCard?: { id: string } }>(client, "message:new");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "", recipient: "bob", cafeGiftCardAmount: 5 });
    const message = await received;

    const wrongRedeemerRejected = waitFor<{ error?: string }>(client, "cafe-gift-card:rejected");
    client.emit("cafe-gift-card:redeem", { roomId: "room-1", messageId: message.id, author: "mallory" });
    await wrongRedeemerRejected;

    const updated = waitFor<{ cafeGiftCard: { redeemed: boolean } }>(client, "cafe-gift-card:updated");
    client.emit("cafe-gift-card:redeem", { roomId: "room-1", messageId: message.id, author: "bob" });
    const updatedPayload = await updated;
    assert.equal(updatedPayload.cafeGiftCard.redeemed, true);

    const doubleRedeemRejected = waitFor<{ error?: string }>(client, "cafe-gift-card:rejected");
    client.emit("cafe-gift-card:redeem", { roomId: "room-1", messageId: message.id, author: "bob" });
    const doubleRedeemPayload = await doubleRedeemRejected;
    assert.match(doubleRedeemPayload.error ?? "", /already been redeemed/);
  } finally {
    client.close();
    httpServer.close();
  }
});

test("Daily challenges (#219): sending a message and a voice note progresses their respective challenges", async () => {
  const { httpServer, baseUrl } = await startChatServer();
  const client = await connectClient(baseUrl);
  try {
    client.emit("join", "room-1");

    const textReceived = waitFor(client, "message:new");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "hi" });
    await textReceived;

    const voiceReceived = waitFor(client, "message:new");
    client.emit("message:send", { roomId: "room-1", author: "alice", text: "", audioUrl: "/api/voice-notes/1", waveform: [1, 2, 3] });
    await voiceReceived;

    const challengesRes = await fetch(`${baseUrl}/api/daily-challenges/alice`);
    const challenges = (await challengesRes.json()).challenges;
    assert.equal(challenges.find((c: { id: string }) => c.id === "messages").progress, 2);
    assert.equal(challenges.find((c: { id: string }) => c.id === "voice-notes").progress, 1);
  } finally {
    client.close();
    httpServer.close();
  }
});
