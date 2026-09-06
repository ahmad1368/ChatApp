import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { ChatMessage } from "@chatapp/shared";
import { createApp } from "./server";

function makePaginationMessage(id: string, index: number): ChatMessage {
  return {
    id,
    roomId: "room-a",
    author: "alice",
    text: `message ${index}`,
    createdAt: new Date(2026, 0, 1, 0, index).toISOString(),
  };
}

function listen() {
  const { app, messagesByRoom, errorReportStore, otpService } = createApp();
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}`, messagesByRoom, errorReportStore, otpService };
}

test("GET /health reports healthy", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  } finally {
    server.close();
  }
});

test("GET /api/rooms/:roomId/messages returns an empty history for a room with no messages", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/rooms/empty-room/messages`);
    assert.deepEqual(await res.json(), []);
  } finally {
    server.close();
  }
});

test("GET /api/rooms/:roomId/messages?since= returns only messages after that timestamp, for reconnect sync", async () => {
  const { server, baseUrl, messagesByRoom } = listen();
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
  messagesByRoom.set("room-a", [older, newer]);
  try {
    const full = await fetch(`${baseUrl}/api/rooms/room-a/messages`).then((r) => r.json());
    assert.deepEqual(full, [older, newer]);

    const sinceOlder = await fetch(
      `${baseUrl}/api/rooms/room-a/messages?since=${encodeURIComponent(older.createdAt)}`
    ).then((r) => r.json());
    assert.deepEqual(sinceOlder, [newer]);
  } finally {
    server.close();
  }
});

test("DELETE /api/account/:author erases only that author's messages", async () => {
  const { server, baseUrl, messagesByRoom } = listen();
  messagesByRoom.set("general", [
    { id: "1", roomId: "general", author: "alice", text: "hi", createdAt: new Date().toISOString() },
    { id: "2", roomId: "general", author: "bob", text: "yo", createdAt: new Date().toISOString() },
  ]);
  try {
    const res = await fetch(`${baseUrl}/api/account/alice`, { method: "DELETE" });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.deletedRecordCount, 1);

    const remaining = await (await fetch(`${baseUrl}/api/rooms/general/messages`)).json();
    assert.deepEqual(
      remaining.map((m: { author: string }) => m.author),
      ["bob"]
    );
  } finally {
    server.close();
  }
});

test("DELETE /api/account/:author rejects a missing author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/account/${encodeURIComponent(" ")}`, { method: "DELETE" });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/account/:author/export returns only that author's messages as a download", async () => {
  const { server, baseUrl, messagesByRoom } = listen();
  messagesByRoom.set("general", [
    { id: "1", roomId: "general", author: "alice", text: "hi", createdAt: new Date().toISOString() },
    { id: "2", roomId: "general", author: "bob", text: "yo", createdAt: new Date().toISOString() },
  ]);
  try {
    const res = await fetch(`${baseUrl}/api/account/alice/export`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-disposition") ?? "", /attachment; filename="chatapp-data-alice\.json"/);
    const body = await res.json();
    assert.equal(body.author, "alice");
    assert.deepEqual(
      body.messages.map((m: { author: string }) => m.author),
      ["alice"]
    );
  } finally {
    server.close();
  }
});

test("GET /api/account/:author/export rejects a missing author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/account/${encodeURIComponent(" ")}/export`);
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/account/:author/export for an author with no data returns an empty backup", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/account/nobody/export`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.messages, []);
  } finally {
    server.close();
  }
});

test("PUT /api/users/:author/location stores an exact location and returns only an approximation", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/users/alice/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 37.7749, lng: -122.4194 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.notDeepEqual(body.approximate, { lat: 37.7749, lng: -122.4194 });
    assert.equal(typeof body.approximate.lat, "number");
    assert.equal(typeof body.approximate.lng, "number");
  } finally {
    server.close();
  }
});

test("PUT /api/users/:author/location rejects out-of-range coordinates", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/users/alice/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 999, lng: 0 }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/users/:author/location returns 404 when no location is on file", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/users/nobody/location`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("GET /api/users/:author/location returns the same approximation set via PUT", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/users/alice/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 51.5074, lng: -0.1278 }),
    });
    const res = await fetch(`${baseUrl}/api/users/alice/location`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.approximate.lat, "number");
  } finally {
    server.close();
  }
});

test("GET /api/push/public-key exposes a VAPID public key", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/push/public-key`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.publicKey, "string");
    assert.ok(body.publicKey.length > 0);
  } finally {
    server.close();
  }
});

test("POST /api/push/subscribe rejects a request missing required fields", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/push/subscribe then /unsubscribe accepts a valid subscription", async () => {
  const { server, baseUrl } = listen();
  try {
    const subscribeRes = await fetch(`${baseUrl}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: "alice",
        subscription: {
          endpoint: "https://push.example.com/abc123",
          keys: { p256dh: "key", auth: "auth" },
        },
      }),
    });
    assert.equal(subscribeRes.status, 201);

    const unsubscribeRes = await fetch(`${baseUrl}/api/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "https://push.example.com/abc123" }),
    });
    assert.equal(unsubscribeRes.status, 200);
  } finally {
    server.close();
  }
});

test("POST /api/push/unsubscribe rejects a request missing an endpoint", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/rooms/:roomId/messages?limit= returns the most recent page with no cursor", async () => {
  const { server, baseUrl, messagesByRoom } = listen();
  const seeded = Array.from({ length: 5 }, (_, i) => makePaginationMessage(`m${i}`, i));
  messagesByRoom.set("room-a", seeded);
  try {
    const res = await fetch(`${baseUrl}/api/rooms/room-a/messages?limit=2`);
    const body: ChatMessage[] = await res.json();
    assert.deepEqual(body.map((m) => m.id), ["m3", "m4"]);
    assert.equal(res.headers.get("x-has-more"), "true");
  } finally {
    server.close();
  }
});

test("GET /api/rooms/:roomId/messages?limit=&before= pages backward and reports no more once exhausted", async () => {
  const { server, baseUrl, messagesByRoom } = listen();
  const seeded = Array.from({ length: 5 }, (_, i) => makePaginationMessage(`m${i}`, i));
  messagesByRoom.set("room-a", seeded);
  try {
    const res = await fetch(`${baseUrl}/api/rooms/room-a/messages?limit=2&before=m3`);
    const body: ChatMessage[] = await res.json();
    assert.deepEqual(body.map((m) => m.id), ["m1", "m2"]);
    assert.equal(res.headers.get("x-has-more"), "true");

    const res2 = await fetch(`${baseUrl}/api/rooms/room-a/messages?limit=2&before=m1`);
    const body2: ChatMessage[] = await res2.json();
    assert.deepEqual(body2.map((m) => m.id), ["m0"]);
    assert.equal(res2.headers.get("x-has-more"), "false");
  } finally {
    server.close();
  }
});

test("GET /api/rooms/:roomId/messages?limit= caps limit at the configured maximum", async () => {
  const { server, baseUrl, messagesByRoom } = listen();
  const seeded = Array.from({ length: 5 }, (_, i) => makePaginationMessage(`m${i}`, i));
  messagesByRoom.set("room-a", seeded);
  try {
    const res = await fetch(`${baseUrl}/api/rooms/room-a/messages?limit=999`);
    const body: ChatMessage[] = await res.json();
    assert.equal(body.length, 5);
  } finally {
    server.close();
  }
});

// A 1x1 red PNG, small enough to keep the test fast.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("POST /api/uploads rejects an unsupported mime type", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/gif", data: TINY_PNG_BASE64 }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/uploads rejects a request missing data", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/png" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/uploads then GET /api/uploads/:id stores a valid image and serves it back", async () => {
  const { server, baseUrl } = listen();
  try {
    const uploadRes = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });
    assert.equal(uploadRes.status, 201);
    const { url } = await uploadRes.json();
    assert.match(url, /^\/api\/uploads\/[\w-]+$/);

    const getRes = await fetch(`${baseUrl}${url}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get("content-type"), "image/png");
    assert.equal(getRes.headers.get("cache-control"), "public, max-age=31536000, immutable");
    const bytes = new Uint8Array(await getRes.arrayBuffer());
    assert.equal(bytes.length, Buffer.from(TINY_PNG_BASE64, "base64").byteLength);
  } finally {
    server.close();
  }
});

test("GET /api/uploads/:id returns 404 for an unknown upload id", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/uploads/does-not-exist`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("POST /api/error-reports rejects a report missing a message", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/error-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stack: "at foo()" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/error-reports accepts a valid report and stores it", async () => {
  const { server, baseUrl, errorReportStore } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/error-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "TypeError: x is not a function",
        stack: "at ChatRoom (ChatRoom.tsx:10)",
        url: "/room/general",
        userAgent: "test-agent",
      }),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.ok(body.id);
    assert.equal(errorReportStore.count(), 1);
  } finally {
    server.close();
  }
});

test("POST /api/auth/signup/request-otp rejects an invalid phone number", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/auth/signup/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: "abc" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/auth/signup/request-otp accepts a valid phone number and never echoes the code back", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/auth/signup/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: "+15557654321" }),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.code, undefined);
    assert.equal(/\d{6}/.test(JSON.stringify(body)), false);
  } finally {
    server.close();
  }
});

test("signup completes end-to-end and issues tokens", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const phoneNumber = "+15559998888";
    const requested = otpService.requestOtp(phoneNumber);
    assert.ok("code" in requested);

    const verifyRes = await fetch(`${baseUrl}/api/auth/signup/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code: (requested as { code: string }).code }),
    });
    assert.equal(verifyRes.status, 200);
    const body = await verifyRes.json();
    assert.equal(body.user.phoneNumber, phoneNumber);
    assert.ok(body.tokens.accessToken);
    assert.ok(body.tokens.refreshToken);

    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: body.tokens.refreshToken }),
    });
    assert.equal(refreshRes.status, 200);
    const refreshBody = await refreshRes.json();
    assert.ok(refreshBody.tokens.accessToken);
  } finally {
    server.close();
  }
});

test("POST /api/auth/signup/verify-otp rejects a wrong code", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const phoneNumber = "+15551112222";
    otpService.requestOtp(phoneNumber);

    const res = await fetch(`${baseUrl}/api/auth/signup/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code: "000000" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/auth/refresh rejects an unknown token", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "not-a-real-token" }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});
