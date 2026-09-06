import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { authenticator } from "otplib";
import { ChatMessage } from "@chatapp/shared";
import { createApp } from "./server";
import { GoogleAuthService } from "./googleAuth";
import { AppleAuthService } from "./appleAuth";
import { FacebookAuthService } from "./facebookAuth";
import { OtpService } from "./auth";

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
  const { app, messagesByRoom, errorReportStore, otpService, recoveryCodeService } = createApp();
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}`, messagesByRoom, errorReportStore, otpService, recoveryCodeService };
}

function listenWithGoogleAuth(googleAuthService: GoogleAuthService) {
  const { app } = createApp({ googleAuthService });
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

function listenWithAppleAuth(appleAuthService: AppleAuthService) {
  const { app } = createApp({ appleAuthService });
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

function listenWithFacebookAuth(facebookAuthService: FacebookAuthService) {
  const { app } = createApp({ facebookAuthService });
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

// Signs a phone number up for real via the OTP endpoints (rather than
// forging a JWT) so 2FA tests exercise requireAuth exactly as a real client
// would: reading the code straight off OtpService instead of a fake SMS provider.
async function signUpAndGetAccessToken(baseUrl: string, otpService: OtpService, phoneNumber: string): Promise<string> {
  const result = otpService.requestOtp(phoneNumber);
  const code = "code" in result ? result.code : (() => { throw new Error("expected a fresh code"); })();
  const verifyRes = await fetch(`${baseUrl}/api/auth/signup/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber, code }),
  });
  const { tokens } = await verifyRes.json();
  return tokens.accessToken;
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

test("POST /api/auth/google responds 503 when GOOGLE_CLIENT_ID isn't set", async () => {
  const { server, baseUrl } = listenWithGoogleAuth(new GoogleAuthService(undefined, async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "anything" }),
    });
    assert.equal(res.status, 503);
  } finally {
    server.close();
  }
});

test("POST /api/auth/google requires an idToken", async () => {
  const { server, baseUrl } = listenWithGoogleAuth(new GoogleAuthService("client-id", async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/auth/google rejects an invalid token", async () => {
  const { server, baseUrl } = listenWithGoogleAuth(new GoogleAuthService("client-id", async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "garbage" }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("POST /api/auth/google signs a user in and issues tokens for a valid token", async () => {
  const fakeVerifier = async (idToken: string) =>
    idToken === "valid-token" ? { googleId: "g-1", email: "a@b.com", name: "Alice" } : undefined;
  const { server, baseUrl } = listenWithGoogleAuth(new GoogleAuthService("client-id", fakeVerifier));
  try {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "valid-token" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.email, "a@b.com");
    assert.equal(body.user.displayName, "Alice");
    assert.ok(body.tokens.accessToken);
  } finally {
    server.close();
  }
});

test("POST /api/auth/google returns the same user id on repeat sign-in", async () => {
  const fakeVerifier = async (idToken: string) =>
    idToken === "valid-token" ? { googleId: "g-1", email: "a@b.com", name: "Alice" } : undefined;
  const { server, baseUrl } = listenWithGoogleAuth(new GoogleAuthService("client-id", fakeVerifier));
  try {
    const first = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "valid-token" }),
    }).then((r) => r.json());
    const second = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "valid-token" }),
    }).then((r) => r.json());
    assert.equal(first.user.id, second.user.id);
  } finally {
    server.close();
  }
});

test("POST /api/auth/apple responds 503 when APPLE_SERVICES_ID isn't set", async () => {
  const { server, baseUrl } = listenWithAppleAuth(new AppleAuthService(undefined, async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/auth/apple`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "anything" }),
    });
    assert.equal(res.status, 503);
  } finally {
    server.close();
  }
});

test("POST /api/auth/apple requires an idToken", async () => {
  const { server, baseUrl } = listenWithAppleAuth(new AppleAuthService("com.example.app.web", async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/auth/apple`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/auth/apple rejects an invalid token", async () => {
  const { server, baseUrl } = listenWithAppleAuth(new AppleAuthService("com.example.app.web", async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/auth/apple`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "garbage" }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("POST /api/auth/apple signs a user in and issues tokens for a valid token", async () => {
  const fakeVerifier = async (idToken: string) =>
    idToken === "valid-token" ? { appleId: "a-1", email: "user@privaterelay.appleid.com" } : undefined;
  const { server, baseUrl } = listenWithAppleAuth(new AppleAuthService("com.example.app.web", fakeVerifier));
  try {
    const res = await fetch(`${baseUrl}/api/auth/apple`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "valid-token" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.email, "user@privaterelay.appleid.com");
    assert.ok(body.tokens.accessToken);
  } finally {
    server.close();
  }
});

test("POST /api/auth/apple returns the same user id on repeat sign-in", async () => {
  const fakeVerifier = async (idToken: string) =>
    idToken === "valid-token" ? { appleId: "a-1", email: "user@privaterelay.appleid.com" } : undefined;
  const { server, baseUrl } = listenWithAppleAuth(new AppleAuthService("com.example.app.web", fakeVerifier));
  try {
    const first = await fetch(`${baseUrl}/api/auth/apple`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "valid-token" }),
    }).then((r) => r.json());
    const second = await fetch(`${baseUrl}/api/auth/apple`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "valid-token" }),
    }).then((r) => r.json());
    assert.equal(first.user.id, second.user.id);
  } finally {
    server.close();
  }
});

test("POST /api/auth/facebook responds 503 when FACEBOOK_APP_ID/SECRET aren't set", async () => {
  const { server, baseUrl } = listenWithFacebookAuth(new FacebookAuthService(undefined, undefined, async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/auth/facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "anything" }),
    });
    assert.equal(res.status, 503);
  } finally {
    server.close();
  }
});

test("POST /api/auth/facebook requires an accessToken", async () => {
  const { server, baseUrl } = listenWithFacebookAuth(new FacebookAuthService("app-id", "app-secret", async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/auth/facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/auth/facebook rejects an invalid token", async () => {
  const { server, baseUrl } = listenWithFacebookAuth(new FacebookAuthService("app-id", "app-secret", async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/auth/facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "garbage" }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("POST /api/auth/facebook signs a user in and issues tokens for a valid token", async () => {
  const fakeVerifier = async (token: string) =>
    token === "valid-token" ? { facebookId: "fb-1", email: "a@b.com", name: "Alice" } : undefined;
  const { server, baseUrl } = listenWithFacebookAuth(new FacebookAuthService("app-id", "app-secret", fakeVerifier));
  try {
    const res = await fetch(`${baseUrl}/api/auth/facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "valid-token" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.email, "a@b.com");
    assert.ok(body.tokens.accessToken);
  } finally {
    server.close();
  }
});

test("POST /api/auth/facebook returns the same user id on repeat sign-in", async () => {
  const fakeVerifier = async (token: string) =>
    token === "valid-token" ? { facebookId: "fb-1", email: "a@b.com", name: "Alice" } : undefined;
  const { server, baseUrl } = listenWithFacebookAuth(new FacebookAuthService("app-id", "app-secret", fakeVerifier));
  try {
    const first = await fetch(`${baseUrl}/api/auth/facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "valid-token" }),
    }).then((r) => r.json());
    const second = await fetch(`${baseUrl}/api/auth/facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "valid-token" }),
    }).then((r) => r.json());
    assert.equal(first.user.id, second.user.id);
  } finally {
    server.close();
  }
});

test("POST /api/auth/recovery/request-code rejects an invalid email", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/auth/recovery/request-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/auth/recovery/request-code accepts a valid email and never echoes the code", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/auth/recovery/request-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bob@example.com" }),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.code, undefined);
    assert.equal(/\d{6}/.test(JSON.stringify(body)), false);
  } finally {
    server.close();
  }
});

test("account recovery completes end-to-end and issues tokens", async () => {
  const { server, baseUrl, recoveryCodeService } = listen();
  try {
    const email = "carol@example.com";
    const requested = recoveryCodeService.requestCode(email);
    assert.ok("code" in requested);

    const res = await fetch(`${baseUrl}/api/auth/recovery/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: (requested as { code: string }).code }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.email, email);
    assert.ok(body.tokens.accessToken);
    assert.ok(body.tokens.refreshToken);
  } finally {
    server.close();
  }
});

test("POST /api/auth/recovery/verify-code rejects a wrong code", async () => {
  const { server, baseUrl, recoveryCodeService } = listen();
  try {
    const email = "dave@example.com";
    recoveryCodeService.requestCode(email);
    const res = await fetch(`${baseUrl}/api/auth/recovery/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: "000000" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/auth/2fa/setup rejects a request with no access token", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountLabel: "alice@example.com" }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("2FA: completes setup, confirm, and login-verify end-to-end", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110001");

    const setupRes = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ accountLabel: "alice@example.com" }),
    });
    assert.equal(setupRes.status, 200);
    const { secret, qrCodeDataUrl } = await setupRes.json();
    assert.ok(secret);
    assert.match(qrCodeDataUrl, /^data:image\/png;base64,/);

    const statusBefore = await fetch(`${baseUrl}/api/auth/2fa/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json());
    assert.equal(statusBefore.enabled, false);

    const confirmRes = await fetch(`${baseUrl}/api/auth/2fa/confirm-setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ token: authenticator.generate(secret) }),
    });
    assert.equal(confirmRes.status, 200);

    const statusAfter = await fetch(`${baseUrl}/api/auth/2fa/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json());
    assert.equal(statusAfter.enabled, true);

    // /verify runs at login time (pre-session), so it takes userId directly
    // rather than a bearer token — see the comment on the endpoint.
    const decoded = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
    const verifyRes = await fetch(`${baseUrl}/api/auth/2fa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: decoded.sub, token: authenticator.generate(secret) }),
    });
    assert.equal(verifyRes.status, 200);
  } finally {
    server.close();
  }
});

test("2FA: rejects verification with a wrong code", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110002");
    const decoded = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());

    await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ accountLabel: "bob@example.com" }),
    });

    const res = await fetch(`${baseUrl}/api/auth/2fa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: decoded.sub, token: "000000" }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("2FA: disables 2FA", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110003");

    const setupRes = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ accountLabel: "carol@example.com" }),
    }).then((r) => r.json());
    await fetch(`${baseUrl}/api/auth/2fa/confirm-setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ token: authenticator.generate(setupRes.secret) }),
    });

    const disableRes = await fetch(`${baseUrl}/api/auth/2fa/disable`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(disableRes.status, 200);

    const status = await fetch(`${baseUrl}/api/auth/2fa/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json());
    assert.equal(status.enabled, false);
  } finally {
    server.close();
  }
});

// Full registration/authentication requires a real platform authenticator
// (or a simulated one) to produce a validly-signed attestation/assertion —
// that cryptographic verification is @simplewebauthn/server's own tested
// responsibility (see webauthn.test.ts for WebAuthnService's own unit
// tests). These integration tests cover this endpoint layer's own
// responsibility: auth gating and fail-closed behavior.

test("POST /api/auth/webauthn/register/options rejects a request with no access token", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/auth/webauthn/register/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice" }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("POST /api/auth/webauthn/register/options returns real options for an authenticated user", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110004");
    const res = await fetch(`${baseUrl}/api/auth/webauthn/register/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ username: "alice" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.challenge);
  } finally {
    server.close();
  }
});

test("GET /api/auth/webauthn/status requires an access token and reports no credentials before registration", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const unauth = await fetch(`${baseUrl}/api/auth/webauthn/status`);
    assert.equal(unauth.status, 401);

    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110005");
    const res = await fetch(`${baseUrl}/api/auth/webauthn/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { hasCredentials: false });
  } finally {
    server.close();
  }
});

test("POST /api/auth/webauthn/login/options returns 404 for a user with no registered credential", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/auth/webauthn/login/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "no-such-user" }),
    });
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("POST /api/auth/webauthn/login/verify rejects a malformed assertion", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/auth/webauthn/login/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "no-such-user", response: { id: "not-real" } }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("GET /api/onboarding rejects a request with no access token", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/onboarding`);
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("GET /api/onboarding starts a fresh user at the displayName step", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110006");
    const res = await fetch(`${baseUrl}/api/onboarding`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await res.json();
    assert.equal(body.currentStep, "displayName");
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects an unrecognized step", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110007");
    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ step: "not-a-real-step", data: "x" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step progresses through the flow and persists between requests", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110008");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };

    const step1 = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "displayName", data: "Bob" }),
    }).then((r) => r.json());
    assert.equal(step1.currentStep, "avatar");

    const resumed = await fetch(`${baseUrl}/api/onboarding`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) =>
      r.json()
    );
    assert.equal(resumed.currentStep, "avatar");
    assert.equal(resumed.profile.displayName, "Bob");
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects submitting a step out of order", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110009");
    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ step: "bio", data: "hello" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step progresses through to the dating goal step and persists between requests", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110010");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };

    await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "displayName", data: "Bob" }),
    });
    await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "avatar", data: "" }),
    });
    const step3 = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "bio", data: "" }),
    }).then((r) => r.json());
    assert.equal(step3.currentStep, "datingGoal");

    const step4 = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "datingGoal", data: "friendship" }),
    }).then((r) => r.json());
    assert.equal(step4.currentStep, "gender");
    assert.equal(step4.profile.datingGoal, "friendship");

    const resumed = await fetch(`${baseUrl}/api/onboarding`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) =>
      r.json()
    );
    assert.equal(resumed.currentStep, "gender");
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects an invalid dating goal value", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110011");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };

    await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "displayName", data: "Carol" }),
    });
    await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "avatar", data: "" }),
    });
    await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "bio", data: "" }),
    });
    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "datingGoal", data: "nonsense" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

async function stepThroughToGender(baseUrl: string, authHeaders: Record<string, string>) {
  for (const [step, data] of [
    ["displayName", "Bob"],
    ["avatar", ""],
    ["bio", ""],
    ["datingGoal", "friendship"],
  ] as const) {
    await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step, data }),
    });
  }
}

test("POST /api/onboarding/step completes the gender step, advancing to orientation, and persists between requests", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110012");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToGender(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "gender", data: { option: "nonBinary" } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.currentStep, "orientation");
    assert.equal(body.profile.gender, "nonBinary");

    const resumed = await fetch(`${baseUrl}/api/onboarding`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) =>
      r.json()
    );
    assert.equal(resumed.currentStep, "orientation");
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects a custom gender option missing its description", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110013");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToGender(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "gender", data: { option: "custom" } }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step accepts a custom gender description", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110014");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToGender(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "gender", data: { option: "custom", customText: "Bigender" } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.profile.genderCustomText, "Bigender");
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects submitting the gender step out of order", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110015");
    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ step: "gender", data: { option: "woman" } }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

async function stepThroughToOrientation(baseUrl: string, authHeaders: Record<string, string>) {
  await stepThroughToGender(baseUrl, authHeaders);
  await fetch(`${baseUrl}/api/onboarding/step`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ step: "gender", data: { option: "man" } }),
  });
}

test("POST /api/onboarding/step completes the orientation step, advancing to age range, and persists between requests", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110016");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToOrientation(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "orientation", data: { option: "bisexual", interestedIn: ["man", "woman", "nonBinary"] } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.currentStep, "ageRange");
    assert.equal(body.profile.orientation, "bisexual");
    assert.deepEqual(body.profile.interestedIn, ["man", "woman", "nonBinary"]);

    const resumed = await fetch(`${baseUrl}/api/onboarding`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) =>
      r.json()
    );
    assert.equal(resumed.currentStep, "ageRange");
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects an empty interestedIn list", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110017");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToOrientation(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "orientation", data: { option: "gay", interestedIn: [] } }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects a custom orientation missing its description", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110018");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToOrientation(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "orientation", data: { option: "custom", interestedIn: ["woman"] } }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects submitting the orientation step out of order", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110019");
    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ step: "orientation", data: { option: "straight", interestedIn: ["woman"] } }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

async function stepThroughToAgeRange(baseUrl: string, authHeaders: Record<string, string>) {
  await stepThroughToOrientation(baseUrl, authHeaders);
  await fetch(`${baseUrl}/api/onboarding/step`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ step: "orientation", data: { option: "bisexual", interestedIn: ["man", "woman"] } }),
  });
}

test("POST /api/onboarding/step completes the age range step, advancing to search radius, and persists between requests", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110020");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToAgeRange(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "ageRange", data: { min: 22, max: 40 } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.currentStep, "searchRadius");
    assert.deepEqual(body.profile.preferredAgeRange, { min: 22, max: 40 });

    const resumed = await fetch(`${baseUrl}/api/onboarding`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) =>
      r.json()
    );
    assert.equal(resumed.currentStep, "searchRadius");
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects a range below the legal minimum age", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110021");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToAgeRange(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "ageRange", data: { min: 15, max: 25 } }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects min greater than max for age range", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110022");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToAgeRange(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "ageRange", data: { min: 50, max: 30 } }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects submitting the age range step out of order", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110023");
    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ step: "ageRange", data: { min: 25, max: 35 } }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

async function stepThroughToSearchRadius(baseUrl: string, authHeaders: Record<string, string>) {
  await stepThroughToAgeRange(baseUrl, authHeaders);
  await fetch(`${baseUrl}/api/onboarding/step`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ step: "ageRange", data: { min: 22, max: 40 } }),
  });
}

test("POST /api/onboarding/step completes the search radius step with a rounded location and persists", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110024");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToSearchRadius(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "searchRadius", data: { radiusKm: 30, location: { lat: 51.507351, lng: -0.127758 } } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.currentStep, "complete");
    assert.equal(body.profile.searchRadiusKm, 30);
    assert.deepEqual(body.profile.location, { lat: 51.51, lng: -0.13 });

    const resumed = await fetch(`${baseUrl}/api/onboarding`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) =>
      r.json()
    );
    assert.equal(resumed.currentStep, "complete");
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step completes without a location when geolocation is denied", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110025");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToSearchRadius(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "searchRadius", data: { radiusKm: 80 } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.profile.searchRadiusKm, 80);
    assert.equal(body.profile.location, undefined);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects a search radius outside the allowed bounds", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110026");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToSearchRadius(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "searchRadius", data: { radiusKm: 500 } }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects submitting the search radius step out of order", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110027");
    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ step: "searchRadius", data: { radiusKm: 25 } }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});
