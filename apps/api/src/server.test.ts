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
import { RecaptchaService } from "./recaptcha";
import { SpotifyService } from "./spotifyAuth";
import { InstagramService } from "./instagramAuth";

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
  const {
    app,
    messagesByRoom,
    errorReportStore,
    otpService,
    recoveryCodeService,
    verificationStore,
    blockStore,
    contactBlockStore,
    watermarkStore,
    photoStore,
  } = createApp();
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    messagesByRoom,
    errorReportStore,
    otpService,
    recoveryCodeService,
    verificationStore,
    blockStore,
    contactBlockStore,
    watermarkStore,
    photoStore,
  };
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

function listenWithSpotify(spotifyService: SpotifyService) {
  const { app } = createApp({ spotifyService });
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

function listenWithInstagram(instagramService: InstagramService) {
  const { app } = createApp({ instagramService });
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

function listenWithRecaptcha(recaptchaService: RecaptchaService) {
  const { app } = createApp({ recaptchaService });
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

test("GET /api/users/:author/passport-location reports inactive before any Passport location is set", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/users/alice/passport-location`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { active: false, cityName: null });
  } finally {
    server.close();
  }
});

test("PUT /api/users/:author/passport-location rejects invalid coordinates", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/users/alice/passport-location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityName: "Tokyo", coordinates: { lat: 999, lng: 0 } }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/users/:author/passport-location activates Passport mode and overrides GET /api/users/:author/location", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/users/alice/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 48.8566, lng: 2.3522 }), // real GPS: Paris
    });

    const putRes = await fetch(`${baseUrl}/api/users/alice/passport-location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityName: "Tokyo", coordinates: { lat: 35.6762, lng: 139.6503 } }),
    });
    assert.equal(putRes.status, 200);

    const statusRes = await fetch(`${baseUrl}/api/users/alice/passport-location`);
    assert.deepEqual(await statusRes.json(), { active: true, cityName: "Tokyo" });

    const locationRes = await fetch(`${baseUrl}/api/users/alice/location`);
    const body = await locationRes.json();
    // Tokyo, not Paris, is the effective location while Passport is active.
    assert.ok(Math.abs(body.approximate.lat - 35.6762) < 1);
  } finally {
    server.close();
  }
});

test("DELETE /api/users/:author/passport-location deactivates Passport mode and reverts to the real GPS location", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/users/alice/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 48.8566, lng: 2.3522 }),
    });
    await fetch(`${baseUrl}/api/users/alice/passport-location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityName: "Tokyo", coordinates: { lat: 35.6762, lng: 139.6503 } }),
    });

    const deleteRes = await fetch(`${baseUrl}/api/users/alice/passport-location`, { method: "DELETE" });
    assert.equal(deleteRes.status, 204);

    const statusRes = await fetch(`${baseUrl}/api/users/alice/passport-location`);
    assert.deepEqual(await statusRes.json(), { active: false, cityName: null });

    const locationRes = await fetch(`${baseUrl}/api/users/alice/location`);
    const body = await locationRes.json();
    assert.ok(Math.abs(body.approximate.lat - 48.8566) < 1);
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

test("GET /api/onboarding starts a fresh user at the communityGuidelines step", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110006");
    const res = await fetch(`${baseUrl}/api/onboarding`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await res.json();
    assert.equal(body.currentStep, "communityGuidelines");
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

test("POST /api/onboarding/step rejects continuing without accepting the community guidelines", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110040");
    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ step: "communityGuidelines", data: { accepted: false } }),
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

    const guidelinesStep = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "communityGuidelines", data: { accepted: true } }),
    }).then((r) => r.json());
    assert.equal(guidelinesStep.currentStep, "displayName");

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
      body: JSON.stringify({ step: "communityGuidelines", data: { accepted: true } }),
    });
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
      body: JSON.stringify({ step: "communityGuidelines", data: { accepted: true } }),
    });
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
  await fetch(`${baseUrl}/api/onboarding/step`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ step: "communityGuidelines", data: { accepted: true } }),
  });
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

test("POST /api/onboarding/step completes the search radius step with a rounded location, advancing to selfie verification, and persists", async () => {
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
    assert.equal(body.currentStep, "selfieVerification");
    assert.equal(body.profile.searchRadiusKm, 30);
    assert.deepEqual(body.profile.location, { lat: 51.51, lng: -0.13 });

    const resumed = await fetch(`${baseUrl}/api/onboarding`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) =>
      r.json()
    );
    assert.equal(resumed.currentStep, "selfieVerification");
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

async function stepThroughToSelfieVerification(baseUrl: string, authHeaders: Record<string, string>) {
  await stepThroughToSearchRadius(baseUrl, authHeaders);
  await fetch(`${baseUrl}/api/onboarding/step`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ step: "searchRadius", data: { radiusKm: 25 } }),
  });
}

test("POST /api/verification/selfie rejects a request with no access token", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/verification/selfie`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("POST /api/verification/selfie accepts a valid selfie and never exposes it via a GET endpoint", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110028");
    const res = await fetch(`${baseUrl}/api/verification/selfie`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { verified: true });

    // There is deliberately no GET /api/verification/... route at all.
    const noRoute = await fetch(`${baseUrl}/api/verification/selfie`);
    assert.equal(noRoute.status, 404);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step wires a submitted selfie into the selfieVerification step", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110029");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToSelfieVerification(baseUrl, authHeaders);

    await fetch(`${baseUrl}/api/verification/selfie`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "selfieVerification", data: {} }),
    });
    const body = await res.json();
    assert.equal(body.currentStep, "complete");
    assert.equal(body.profile.isSelfieVerified, true);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step marks isSelfieVerified false when the user skips", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110030");
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    await stepThroughToSelfieVerification(baseUrl, authHeaders);

    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ step: "selfieVerification", data: { skipped: true } }),
    });
    const body = await res.json();
    assert.equal(body.currentStep, "complete");
    assert.equal(body.profile.isSelfieVerified, false);
  } finally {
    server.close();
  }
});

test("POST /api/onboarding/step rejects submitting the selfie verification step out of order", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110031");
    const res = await fetch(`${baseUrl}/api/onboarding/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ step: "selfieVerification", data: {} }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/users/:userId/badge reports unverified for a user who never submitted a selfie", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/users/user-1/badge`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { verified: false });
  } finally {
    server.close();
  }
});

test("GET /api/users/:userId/badge reports verified after a selfie is accepted, without exposing the image", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110032");
    const decoded = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());

    await fetch(`${baseUrl}/api/verification/selfie`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });

    const res = await fetch(`${baseUrl}/api/users/${decoded.sub}/badge`);
    const body = await res.json();
    assert.deepEqual(body, { verified: true });
    assert.equal("selfie" in body, false);
    assert.equal("data" in body, false);
  } finally {
    server.close();
  }
});

test("GET /api/users/:userId/badge is independent per user", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/users/some-other-user/badge`);
    const body = await res.json();
    assert.equal(body.verified, false);
  } finally {
    server.close();
  }
});

test("POST /api/reports rejects a report with an invalid reason", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reporterAuthor: "alice", reportedAuthor: "bob", reason: "nonsense" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/reports accepts a valid report", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reporterAuthor: "alice", reportedAuthor: "bob", reason: "harassment", messageId: "msg-1" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
  } finally {
    server.close();
  }
});

test("GET /api/reports has no route exposing stored reports", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/reports`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("POST /api/blocks creates a block", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice", blockedAuthor: "bob" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.blockerAuthor, "alice");
    assert.equal(body.blockedAuthor, "bob");
  } finally {
    server.close();
  }
});

test("POST /api/blocks rejects missing fields", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/blocks/:blockerAuthor returns only that author's own blocks", async () => {
  const { server, baseUrl, blockStore } = listen();
  try {
    blockStore.block("alice", "bob");
    blockStore.block("dave", "alice");
    const res = await fetch(`${baseUrl}/api/blocks/alice`);
    const body = await res.json();
    assert.deepEqual(body.blockedAuthors, ["bob"]);
  } finally {
    server.close();
  }
});

test("DELETE /api/blocks removes a block, 404s if absent", async () => {
  const { server, baseUrl, blockStore } = listen();
  try {
    blockStore.block("alice", "bob");
    const ok = await fetch(`${baseUrl}/api/blocks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice", blockedAuthor: "bob" }),
    });
    assert.equal(ok.status, 204);

    const missing = await fetch(`${baseUrl}/api/blocks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice", blockedAuthor: "bob" }),
    });
    assert.equal(missing.status, 404);
  } finally {
    server.close();
  }
});

test("GET /api/rooms/:roomId/messages filters mutually-blocked authors for a viewer", async () => {
  const { server, baseUrl, messagesByRoom, blockStore } = listen();
  try {
    blockStore.block("alice", "bob");
    messagesByRoom.set("general", [
      { id: "1", roomId: "general", author: "bob", text: "hi", createdAt: new Date().toISOString() },
      { id: "2", roomId: "general", author: "carol", text: "hey", createdAt: new Date().toISOString() },
    ]);

    const res = await fetch(`${baseUrl}/api/rooms/general/messages?viewer=alice`);
    const body = await res.json();
    assert.deepEqual(
      body.map((m: { author: string }) => m.author),
      ["carol"]
    );

    const unfiltered = await fetch(`${baseUrl}/api/rooms/general/messages`);
    const unfilteredBody = await unfiltered.json();
    assert.equal(unfilteredBody.length, 2);
  } finally {
    server.close();
  }
});

test("POST /api/profile/phone registers a phone, rejects invalid input", async () => {
  const { server, baseUrl } = listen();
  try {
    const ok = await fetch(`${baseUrl}/api/profile/phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob", phoneNumber: "555-123-4567" }),
    });
    assert.equal(ok.status, 204);

    const bad = await fetch(`${baseUrl}/api/profile/phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob", phoneNumber: "123" }),
    });
    assert.equal(bad.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/contacts/block blocks authors matching an uploaded contact list", async () => {
  const { server, baseUrl, blockStore } = listen();
  try {
    await fetch(`${baseUrl}/api/profile/phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob", phoneNumber: "555-123-4567" }),
    });

    const res = await fetch(`${baseUrl}/api/contacts/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", phoneNumbers: ["555.123.4567", "000-000-0000"] }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.blockedAuthors, ["bob"]);
    assert.equal(blockStore.isMutuallyBlocked("alice", "bob"), true);
  } finally {
    server.close();
  }
});

test("POST /api/contacts/block requires an author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/contacts/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumbers: ["5551234567"] }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/watermark/session issues a trace code", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/watermark/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", roomId: "general" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.author, "alice");
    assert.equal(body.roomId, "general");
    assert.ok(body.traceCode);
  } finally {
    server.close();
  }
});

test("POST /api/watermark/session rejects missing fields", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/watermark/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("issued trace codes are resolvable internally via the store, not via any HTTP endpoint", async () => {
  const { server, baseUrl, watermarkStore } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/watermark/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", roomId: "general" }),
    });
    const { traceCode } = await res.json();

    const resolved = watermarkStore.lookup(traceCode);
    assert.equal(resolved?.author, "alice");
    assert.equal(resolved?.roomId, "general");

    const leakAttempt = await fetch(`${baseUrl}/api/watermark/${traceCode}`);
    assert.equal(leakAttempt.status, 404);
  } finally {
    server.close();
  }
});

test("POST /api/photos uploads a photo", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
  } finally {
    server.close();
  }
});

test("POST /api/photos rejects an invalid mime type", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", mimeType: "image/gif", data: TINY_PNG_BASE64 }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/photos/:id returns a watermarked image, not the original bytes", async () => {
  const { server, baseUrl, photoStore } = listen();
  try {
    const uploaded = photoStore.upload("alice", "image/png", TINY_PNG_BASE64);
    assert.equal(uploaded.success, true);
    const id = uploaded.success ? uploaded.photo.id : "";
    const res = await fetch(`${baseUrl}/api/photos/${id}?viewer=bob`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/png");
    const served = Buffer.from(await res.arrayBuffer());
    const original = Buffer.from(TINY_PNG_BASE64, "base64");
    assert.notDeepEqual(served, original);
  } finally {
    server.close();
  }
});

test("GET /api/photos/:id 404s for an unknown id", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/photos/does-not-exist`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("PUT /api/photo-albums/:owner/access-level sets and GET reads it back", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/photo-albums/alice/access-level`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessLevel: "private" }),
    });
    assert.equal(putRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/photo-albums/alice/access-level`);
    assert.deepEqual(await getRes.json(), { accessLevel: "private" });
  } finally {
    server.close();
  }
});

test("PUT /api/photo-albums/:owner/access-level rejects an invalid level", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/photo-albums/alice/access-level`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessLevel: "hidden" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/photos/:id 403s a private album for anyone but the owner", async () => {
  const { server, baseUrl, photoStore } = listen();
  try {
    const uploaded = photoStore.upload("alice", "image/png", TINY_PNG_BASE64);
    const id = uploaded.success ? uploaded.photo.id : "";
    await fetch(`${baseUrl}/api/photo-albums/alice/access-level`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessLevel: "private" }),
    });

    const strangerRes = await fetch(`${baseUrl}/api/photos/${id}?viewer=bob`);
    assert.equal(strangerRes.status, 403);

    const ownerRes = await fetch(`${baseUrl}/api/photos/${id}?viewer=alice`);
    assert.equal(ownerRes.status, 200);
  } finally {
    server.close();
  }
});

test("request-access flow: pending until approved, then GET succeeds", async () => {
  const { server, baseUrl, photoStore } = listen();
  try {
    const uploaded = photoStore.upload("alice", "image/png", TINY_PNG_BASE64);
    const id = uploaded.success ? uploaded.photo.id : "";
    await fetch(`${baseUrl}/api/photo-albums/alice/access-level`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessLevel: "requestAccess" }),
    });

    const beforeRes = await fetch(`${baseUrl}/api/photos/${id}?viewer=bob`);
    assert.equal(beforeRes.status, 403);

    const requestRes = await fetch(`${baseUrl}/api/photo-albums/alice/access-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requester: "bob" }),
    });
    assert.equal(requestRes.status, 201);

    const pendingRes = await fetch(`${baseUrl}/api/photo-albums/alice/access-requests`);
    assert.deepEqual(await pendingRes.json(), { pending: ["bob"] });

    const respondRes = await fetch(`${baseUrl}/api/photo-albums/alice/access-requests/bob/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    });
    assert.equal(respondRes.status, 200);

    const afterRes = await fetch(`${baseUrl}/api/photos/${id}?viewer=bob`);
    assert.equal(afterRes.status, 200);
  } finally {
    server.close();
  }
});

const VALID_SHARED_DATE_PAYLOAD = {
  meetingWith: "Jordan",
  location: "Blue Bottle Coffee",
  scheduledAt: "2026-09-10T18:00:00.000Z",
  contactNames: ["Sam", "Priya"],
};

test("POST /api/shared-dates creates a plan with per-contact share codes", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/shared-dates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", ...VALID_SHARED_DATE_PAYLOAD }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.contacts.length, 2);
    assert.equal(body.status, "planned");
  } finally {
    server.close();
  }
});

test("POST /api/shared-dates rejects an invalid payload", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/shared-dates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PATCH /api/shared-dates/:id/status updates status only for the sharer", async () => {
  const { server, baseUrl } = listen();
  try {
    const created = await fetch(`${baseUrl}/api/shared-dates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", ...VALID_SHARED_DATE_PAYLOAD }),
    }).then((r) => r.json());

    const forbidden = await fetch(`${baseUrl}/api/shared-dates/${created.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "mallory", status: "safe" }),
    });
    assert.equal(forbidden.status, 400);

    const ok = await fetch(`${baseUrl}/api/shared-dates/${created.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", status: "arrived" }),
    });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.status, "arrived");
  } finally {
    server.close();
  }
});

test("GET /api/shared-dates/shared/:shareCode reflects live status for a trusted contact", async () => {
  const { server, baseUrl } = listen();
  try {
    const created = await fetch(`${baseUrl}/api/shared-dates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", ...VALID_SHARED_DATE_PAYLOAD }),
    }).then((r) => r.json());

    await fetch(`${baseUrl}/api/shared-dates/${created.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", status: "on_the_way" }),
    });

    const res = await fetch(`${baseUrl}/api/shared-dates/shared/${created.contacts[0].shareCode}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "on_the_way");
    assert.equal(body.author, "alice");
  } finally {
    server.close();
  }
});

test("POST /api/shared-dates/:id/revoke invalidates all share codes", async () => {
  const { server, baseUrl } = listen();
  try {
    const created = await fetch(`${baseUrl}/api/shared-dates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", ...VALID_SHARED_DATE_PAYLOAD }),
    }).then((r) => r.json());

    const revokeRes = await fetch(`${baseUrl}/api/shared-dates/${created.id}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(revokeRes.status, 204);

    const viewRes = await fetch(`${baseUrl}/api/shared-dates/shared/${created.contacts[0].shareCode}`);
    assert.equal(viewRes.status, 404);
  } finally {
    server.close();
  }
});

test("GET /api/shared-dates/shared/:shareCode 404s for an unknown code", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/shared-dates/shared/does-not-exist`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

const VALID_SOS_LOCATION = { latitude: 37.7749, longitude: -122.4194, accuracy: 12 };

test("POST /api/sos/contacts registers an emergency contact", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/sos/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", name: "Sam", contactMethod: "+15551234567" }),
    });
    assert.equal(res.status, 201);

    const list = await fetch(`${baseUrl}/api/sos/contacts/alice`);
    const body = await list.json();
    assert.equal(body.contacts.length, 1);
  } finally {
    server.close();
  }
});

test("POST /api/sos/alerts rejects triggering without registered contacts", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/sos/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", ...VALID_SOS_LOCATION }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/sos/alerts triggers an alert and issues per-contact share codes", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/sos/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", name: "Sam", contactMethod: "+15551234567" }),
    });
    await fetch(`${baseUrl}/api/sos/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", name: "Priya", contactMethod: "priya@example.com" }),
    });

    const res = await fetch(`${baseUrl}/api/sos/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", ...VALID_SOS_LOCATION }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.contacts.length, 2);
    assert.equal(body.resolved, false);
  } finally {
    server.close();
  }
});

test("PATCH /api/sos/alerts/:id/location updates the live position for trusted contacts", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/sos/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", name: "Sam", contactMethod: "+15551234567" }),
    });
    const created = await fetch(`${baseUrl}/api/sos/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", ...VALID_SOS_LOCATION }),
    }).then((r) => r.json());

    const res = await fetch(`${baseUrl}/api/sos/alerts/${created.id}/location`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", latitude: 1, longitude: 1 }),
    });
    assert.equal(res.status, 200);

    const view = await fetch(`${baseUrl}/api/sos/alerts/shared/${created.contacts[0].shareCode}`);
    const viewBody = await view.json();
    assert.equal(viewBody.location.latitude, 1);
  } finally {
    server.close();
  }
});

test("POST /api/sos/alerts/:id/resolve marks the alert resolved for viewers", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/sos/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", name: "Sam", contactMethod: "+15551234567" }),
    });
    const created = await fetch(`${baseUrl}/api/sos/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", ...VALID_SOS_LOCATION }),
    }).then((r) => r.json());

    const res = await fetch(`${baseUrl}/api/sos/alerts/${created.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 204);

    const view = await fetch(`${baseUrl}/api/sos/alerts/shared/${created.contacts[0].shareCode}`);
    const viewBody = await view.json();
    assert.equal(viewBody.resolved, true);
  } finally {
    server.close();
  }
});

test("GET /api/sos/alerts/shared/:shareCode 404s for an unknown code", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/sos/alerts/shared/does-not-exist`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("GET /api/webauthn/status/:author starts unregistered", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/webauthn/status/alice`);
    const body = await res.json();
    assert.equal(body.registered, false);
  } finally {
    server.close();
  }
});

test("POST /api/webauthn/registration/options issues a challenge for a valid author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/webauthn/registration/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.challenge);
  } finally {
    server.close();
  }
});

test("POST /api/webauthn/registration/options rejects a missing author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/webauthn/registration/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/webauthn/registration/verify rejects without a pending challenge", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/webauthn/registration/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", response: {} }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/webauthn/authentication/options rejects an author with no registered credential", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/webauthn/authentication/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/auth/duplicate-status requires a valid access token", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/auth/duplicate-status`);
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("GET /api/auth/duplicate-status is unflagged for a lone signup", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110050");
    const res = await fetch(`${baseUrl}/api/auth/duplicate-status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { flagged: false, matchedUserIds: [] });
  } finally {
    server.close();
  }
});

test("GET /api/auth/duplicate-status flags two accounts that signed up from the same network address", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    // Both requests come from this test process, so they share an IP —
    // enough on its own to flag, even with the deviceFingerprint field
    // omitted from one of them.
    const accessTokenA = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110051");
    const accessTokenB = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110052");

    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/auth/duplicate-status`, { headers: { Authorization: `Bearer ${accessTokenA}` } }),
      fetch(`${baseUrl}/api/auth/duplicate-status`, { headers: { Authorization: `Bearer ${accessTokenB}` } }),
    ]);
    assert.equal((await resA.json()).flagged, true);
    assert.equal((await resB.json()).flagged, true);
  } finally {
    server.close();
  }
});

test("GET /api/discovery-visibility requires a valid access token", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/discovery-visibility`);
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("GET /api/discovery-visibility defaults to visible-to-everyone", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110053");
    const res = await fetch(`${baseUrl}/api/discovery-visibility`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      city: "",
      workplace: "",
      hideFromSameCity: false,
      hideFromSameWorkplace: false,
    });
  } finally {
    server.close();
  }
});

test("PUT /api/discovery-visibility saves and round-trips city/workplace preferences", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110054");
    const putRes = await fetch(`${baseUrl}/api/discovery-visibility`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ city: "Springfield", workplace: "Acme Corp", hideFromSameCity: true, hideFromSameWorkplace: true }),
    });
    assert.equal(putRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/discovery-visibility`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.deepEqual(await getRes.json(), {
      city: "Springfield",
      workplace: "Acme Corp",
      hideFromSameCity: true,
      hideFromSameWorkplace: true,
    });
  } finally {
    server.close();
  }
});

test("PUT /api/discovery-visibility rejects an overlong city", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110055");
    const res = await fetch(`${baseUrl}/api/discovery-visibility`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ city: "x".repeat(81) }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/auth/signup/request-otp rejects when reCAPTCHA verification fails", async () => {
  const { server, baseUrl } = listenWithRecaptcha(new RecaptchaService("test-secret", async () => false));
  try {
    const res = await fetch(`${baseUrl}/api/auth/signup/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: "+15551110060", recaptchaToken: "bad-token" }),
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

test("POST /api/auth/signup/request-otp succeeds when reCAPTCHA verification passes", async () => {
  const { server, baseUrl } = listenWithRecaptcha(new RecaptchaService("test-secret", async () => true));
  try {
    const res = await fetch(`${baseUrl}/api/auth/signup/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: "+15551110061", recaptchaToken: "good-token" }),
    });
    assert.equal(res.status, 202);
  } finally {
    server.close();
  }
});

test("GET /api/auth/sessions requires a valid access token", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/auth/sessions`);
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("GET /api/auth/sessions lists one session per sign-in, with exactly one marked current", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    await signUpAndGetAccessToken(baseUrl, otpService, "+15551110070");
    const accessTokenB = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110070");

    const res = await fetch(`${baseUrl}/api/auth/sessions`, { headers: { Authorization: `Bearer ${accessTokenB}` } });
    const body = await res.json();
    assert.equal(body.sessions.length, 2);
    assert.equal(body.sessions.filter((s: { isCurrent: boolean }) => s.isCurrent).length, 1);
  } finally {
    server.close();
  }
});

test("DELETE /api/auth/sessions/:sessionId revokes another session but not the caller's own", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    await signUpAndGetAccessToken(baseUrl, otpService, "+15551110071");
    const accessTokenB = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110071");

    const listRes = await fetch(`${baseUrl}/api/auth/sessions`, { headers: { Authorization: `Bearer ${accessTokenB}` } });
    const { sessions } = (await listRes.json()) as { sessions: { id: string; isCurrent: boolean }[] };
    const otherSession = sessions.find((s) => !s.isCurrent);
    assert.ok(otherSession);

    const deleteRes = await fetch(`${baseUrl}/api/auth/sessions/${otherSession!.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessTokenB}` },
    });
    assert.equal(deleteRes.status, 204);

    const afterRes = await fetch(`${baseUrl}/api/auth/sessions`, { headers: { Authorization: `Bearer ${accessTokenB}` } });
    assert.equal((await afterRes.json()).sessions.length, 1);
  } finally {
    server.close();
  }
});

test("DELETE /api/auth/sessions/:sessionId rejects revoking your own current session", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110072");
    const listRes = await fetch(`${baseUrl}/api/auth/sessions`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const { sessions } = await listRes.json();

    const res = await fetch(`${baseUrl}/api/auth/sessions/${sessions[0].id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("DELETE /api/auth/sessions/others logs out every other device, keeping the caller's own", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    const accessTokenA = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110073");
    await signUpAndGetAccessToken(baseUrl, otpService, "+15551110073");
    await signUpAndGetAccessToken(baseUrl, otpService, "+15551110073");

    const res = await fetch(`${baseUrl}/api/auth/sessions/others`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessTokenA}` },
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).revokedCount, 2);

    const afterRes = await fetch(`${baseUrl}/api/auth/sessions`, { headers: { Authorization: `Bearer ${accessTokenA}` } });
    assert.equal((await afterRes.json()).sessions.length, 1);
  } finally {
    server.close();
  }
});

test("POST /api/photo-albums/:owner/photos adds an uploaded photo to the album", async () => {
  const { server, baseUrl, photoStore } = listen();
  try {
    const uploaded = photoStore.upload("alice", "image/png", TINY_PNG_BASE64);
    const id = uploaded.success ? uploaded.photo.id : "";

    const res = await fetch(`${baseUrl}/api/photo-albums/alice/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: id }),
    });
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { photoIds: [id] });

    const listRes = await fetch(`${baseUrl}/api/photo-albums/alice/photos`);
    assert.deepEqual(await listRes.json(), { photoIds: [id] });
  } finally {
    server.close();
  }
});

test("POST /api/photo-albums/:owner/photos rejects a photoId uploaded by someone else", async () => {
  const { server, baseUrl, photoStore } = listen();
  try {
    const uploaded = photoStore.upload("bob", "image/png", TINY_PNG_BASE64);
    const id = uploaded.success ? uploaded.photo.id : "";

    const res = await fetch(`${baseUrl}/api/photo-albums/alice/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: id }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/photo-albums/:owner/photos rejects a 10th photo", async () => {
  const { server, baseUrl, photoStore } = listen();
  try {
    for (let i = 0; i < 9; i++) {
      const uploaded = photoStore.upload("alice", "image/png", TINY_PNG_BASE64);
      const id = uploaded.success ? uploaded.photo.id : "";
      await fetch(`${baseUrl}/api/photo-albums/alice/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: id }),
      });
    }
    const overflow = photoStore.upload("alice", "image/png", TINY_PNG_BASE64);
    const overflowId = overflow.success ? overflow.photo.id : "";
    const res = await fetch(`${baseUrl}/api/photo-albums/alice/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: overflowId }),
    });
    assert.equal(res.status, 400);

    const listRes = await fetch(`${baseUrl}/api/photo-albums/alice/photos`);
    assert.equal((await listRes.json()).photoIds.length, 9);
  } finally {
    server.close();
  }
});

test("DELETE /api/photo-albums/:owner/photos/:photoId removes a photo from the album", async () => {
  const { server, baseUrl, photoStore } = listen();
  try {
    const uploaded = photoStore.upload("alice", "image/png", TINY_PNG_BASE64);
    const id = uploaded.success ? uploaded.photo.id : "";
    await fetch(`${baseUrl}/api/photo-albums/alice/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: id }),
    });

    const res = await fetch(`${baseUrl}/api/photo-albums/alice/photos/${id}`, { method: "DELETE" });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { photoIds: [] });
  } finally {
    server.close();
  }
});

test("PUT /api/photo-albums/:owner/photos/order reorders the album", async () => {
  const { server, baseUrl, photoStore } = listen();
  try {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const uploaded = photoStore.upload("alice", "image/png", TINY_PNG_BASE64);
      const id = uploaded.success ? uploaded.photo.id : "";
      ids.push(id);
      await fetch(`${baseUrl}/api/photo-albums/alice/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: id }),
      });
    }

    const reversed = [...ids].reverse();
    const res = await fetch(`${baseUrl}/api/photo-albums/alice/photos/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: reversed }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { photoIds: reversed });

    const listRes = await fetch(`${baseUrl}/api/photo-albums/alice/photos`);
    assert.deepEqual(await listRes.json(), { photoIds: reversed });
  } finally {
    server.close();
  }
});

test("PUT /api/photo-albums/:owner/photos/order rejects a reorder that drops a photo", async () => {
  const { server, baseUrl, photoStore } = listen();
  try {
    const uploaded1 = photoStore.upload("alice", "image/png", TINY_PNG_BASE64);
    const id1 = uploaded1.success ? uploaded1.photo.id : "";
    const uploaded2 = photoStore.upload("alice", "image/png", TINY_PNG_BASE64);
    const id2 = uploaded2.success ? uploaded2.photo.id : "";
    await fetch(`${baseUrl}/api/photo-albums/alice/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: id1 }),
    });
    await fetch(`${baseUrl}/api/photo-albums/alice/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: id2 }),
    });

    const res = await fetch(`${baseUrl}/api/photo-albums/alice/photos/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: [id1] }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/intro-video/:author 404s when none is uploaded", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/intro-video/alice`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("POST /api/intro-video uploads a video, then GET serves it back with the right content type", async () => {
  const { server, baseUrl } = listen();
  try {
    const data = Buffer.from("fake mp4 bytes").toString("base64");
    const uploadRes = await fetch(`${baseUrl}/api/intro-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", mimeType: "video/mp4", data }),
    });
    assert.equal(uploadRes.status, 201);

    const getRes = await fetch(`${baseUrl}/api/intro-video/alice`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get("content-type"), "video/mp4");
    const served = Buffer.from(await getRes.arrayBuffer());
    assert.deepEqual(served, Buffer.from(data, "base64"));
  } finally {
    server.close();
  }
});

test("POST /api/intro-video rejects an unsupported mime type", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/intro-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", mimeType: "video/avi", data: "abc" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("DELETE /api/intro-video/:author removes the video", async () => {
  const { server, baseUrl } = listen();
  try {
    const data = Buffer.from("fake mp4 bytes").toString("base64");
    await fetch(`${baseUrl}/api/intro-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", mimeType: "video/mp4", data }),
    });
    const deleteRes = await fetch(`${baseUrl}/api/intro-video/alice`, { method: "DELETE" });
    assert.equal(deleteRes.status, 204);

    const getRes = await fetch(`${baseUrl}/api/intro-video/alice`);
    assert.equal(getRes.status, 404);
  } finally {
    server.close();
  }
});

test("GET /api/voice-intro/:author 404s when none is uploaded", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/voice-intro/alice`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("POST /api/voice-intro uploads a clip, then GET serves it back with the right content type", async () => {
  const { server, baseUrl } = listen();
  try {
    const data = Buffer.from("fake audio bytes").toString("base64");
    const uploadRes = await fetch(`${baseUrl}/api/voice-intro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", mimeType: "audio/webm", data }),
    });
    assert.equal(uploadRes.status, 201);

    const getRes = await fetch(`${baseUrl}/api/voice-intro/alice`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get("content-type"), "audio/webm");
    const served = Buffer.from(await getRes.arrayBuffer());
    assert.deepEqual(served, Buffer.from(data, "base64"));
  } finally {
    server.close();
  }
});

test("POST /api/voice-intro rejects an unsupported mime type", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/voice-intro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", mimeType: "audio/x-wav", data: "abc" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("DELETE /api/voice-intro/:author removes the clip", async () => {
  const { server, baseUrl } = listen();
  try {
    const data = Buffer.from("fake audio bytes").toString("base64");
    await fetch(`${baseUrl}/api/voice-intro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", mimeType: "audio/webm", data }),
    });
    const deleteRes = await fetch(`${baseUrl}/api/voice-intro/alice`, { method: "DELETE" });
    assert.equal(deleteRes.status, 204);

    const getRes = await fetch(`${baseUrl}/api/voice-intro/alice`);
    assert.equal(getRes.status, 404);
  } finally {
    server.close();
  }
});

test("GET /api/bio/:author returns an empty bio before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/bio/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { bio: "" });
  } finally {
    server.close();
  }
});

test("PUT /api/bio/:author sets the bio, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/bio/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "Loves hiking and coffee" }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { bio: "Loves hiking and coffee" });

    const getRes = await fetch(`${baseUrl}/api/bio/alice`);
    assert.deepEqual(await getRes.json(), { bio: "Loves hiking and coffee" });
  } finally {
    server.close();
  }
});

test("PUT /api/bio/:author rejects a bio over the character limit", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/bio/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "a".repeat(281) }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/bio/:author rejects a bio containing a phone number", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/bio/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "text me at 555-123-4567" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/profile-prompts/catalog returns the fixed prompt catalog", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-prompts/catalog`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.prompts) && body.prompts.length > 0);
    assert.ok(typeof body.prompts[0].id === "string" && typeof body.prompts[0].text === "string");
  } finally {
    server.close();
  }
});

test("GET /api/profile-prompts/:author returns an empty list before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-prompts/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { answers: [] });
  } finally {
    server.close();
  }
});

test("PUT /api/profile-prompts/:author sets answers, then GET returns them resolved", async () => {
  const { server, baseUrl } = listen();
  try {
    const catalogRes = await fetch(`${baseUrl}/api/profile-prompts/catalog`);
    const { prompts } = await catalogRes.json();
    const promptId = prompts[0].id;

    const putRes = await fetch(`${baseUrl}/api/profile-prompts/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: [{ promptId, answer: "Loves hiking" }] }),
    });
    assert.equal(putRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/profile-prompts/alice`);
    const body = await getRes.json();
    assert.equal(body.answers.length, 1);
    assert.equal(body.answers[0].promptId, promptId);
    assert.equal(body.answers[0].answer, "Loves hiking");
    assert.equal(body.answers[0].prompt, prompts[0].text);
  } finally {
    server.close();
  }
});

test("PUT /api/profile-prompts/:author rejects more than 3 selected prompts", async () => {
  const { server, baseUrl } = listen();
  try {
    const catalogRes = await fetch(`${baseUrl}/api/profile-prompts/catalog`);
    const { prompts } = await catalogRes.json();
    const answers = prompts.slice(0, 4).map((p: { id: string }) => ({ promptId: p.id, answer: "An answer" }));

    const res = await fetch(`${baseUrl}/api/profile-prompts/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/profile-prompts/:author rejects an unknown prompt id", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-prompts/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: [{ promptId: "not-a-real-prompt", answer: "Hello" }] }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/job-info/:author returns empty fields before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/job-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { jobInfo: { jobTitle: "", company: "", hideCompany: false } });
  } finally {
    server.close();
  }
});

test("PUT /api/job-info/:author sets job info, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/job-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle: "Software Engineer", company: "Acme Corp", hideCompany: true }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), {
      jobInfo: { jobTitle: "Software Engineer", company: "Acme Corp", hideCompany: true },
    });

    const getRes = await fetch(`${baseUrl}/api/job-info/alice`);
    assert.deepEqual(await getRes.json(), {
      jobInfo: { jobTitle: "Software Engineer", company: "Acme Corp", hideCompany: true },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/job-info/:author rejects a job title over the character limit", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/job-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle: "a".repeat(101), company: "Acme", hideCompany: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/job-info/:author rejects a company containing a phone number", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/job-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle: "Engineer", company: "call 555-123-4567", hideCompany: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/education-info/:author returns empty fields before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/education-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { educationInfo: { school: "", hideSchool: false } });
  } finally {
    server.close();
  }
});

test("PUT /api/education-info/:author sets education info, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/education-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school: "State University", hideSchool: true }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { educationInfo: { school: "State University", hideSchool: true } });

    const getRes = await fetch(`${baseUrl}/api/education-info/alice`);
    assert.deepEqual(await getRes.json(), { educationInfo: { school: "State University", hideSchool: true } });
  } finally {
    server.close();
  }
});

test("PUT /api/education-info/:author rejects a school over the character limit", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/education-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school: "a".repeat(101), hideSchool: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/education-info/:author rejects a school containing a phone number", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/education-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school: "call 555-123-4567", hideSchool: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/height-info/:author returns empty fields before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/height-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { heightInfo: { heightCm: null, hideHeight: false } });
  } finally {
    server.close();
  }
});

test("PUT /api/height-info/:author sets height info, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/height-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heightCm: 170, hideHeight: true }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { heightInfo: { heightCm: 170, hideHeight: true } });

    const getRes = await fetch(`${baseUrl}/api/height-info/alice`);
    assert.deepEqual(await getRes.json(), { heightInfo: { heightCm: 170, hideHeight: true } });
  } finally {
    server.close();
  }
});

test("PUT /api/height-info/:author rejects a height outside the valid range", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/height-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heightCm: 999, hideHeight: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/height-info/:author accepts a null height to clear it", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/height-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heightCm: 170, hideHeight: false }),
    });
    const res = await fetch(`${baseUrl}/api/height-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heightCm: null, hideHeight: false }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { heightInfo: { heightCm: null, hideHeight: false } });
  } finally {
    server.close();
  }
});

test("GET /api/lifestyle-info/:author returns empty fields before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/lifestyle-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      lifestyleInfo: { smoking: null, drinking: null, hideSmoking: false, hideDrinking: false },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/lifestyle-info/:author sets lifestyle info, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/lifestyle-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smoking: "sometimes", drinking: "onSpecialOccasions", hideSmoking: true, hideDrinking: false }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), {
      lifestyleInfo: { smoking: "sometimes", drinking: "onSpecialOccasions", hideSmoking: true, hideDrinking: false },
    });

    const getRes = await fetch(`${baseUrl}/api/lifestyle-info/alice`);
    assert.deepEqual(await getRes.json(), {
      lifestyleInfo: { smoking: "sometimes", drinking: "onSpecialOccasions", hideSmoking: true, hideDrinking: false },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/lifestyle-info/:author rejects an invalid smoking option", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/lifestyle-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smoking: "a-lot", drinking: "no", hideSmoking: false, hideDrinking: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/lifestyle-info/:author rejects an invalid drinking option", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/lifestyle-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smoking: "no", drinking: "heavily", hideSmoking: false, hideDrinking: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/family-plans-info/:author returns empty fields before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/family-plans-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { familyPlansInfo: { familyPlans: null, hideFamilyPlans: false } });
  } finally {
    server.close();
  }
});

test("PUT /api/family-plans-info/:author sets the value, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/family-plans-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyPlans: "openToChildren", hideFamilyPlans: true }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { familyPlansInfo: { familyPlans: "openToChildren", hideFamilyPlans: true } });

    const getRes = await fetch(`${baseUrl}/api/family-plans-info/alice`);
    assert.deepEqual(await getRes.json(), { familyPlansInfo: { familyPlans: "openToChildren", hideFamilyPlans: true } });
  } finally {
    server.close();
  }
});

test("PUT /api/family-plans-info/:author rejects an invalid option", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/family-plans-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyPlans: "maybe", hideFamilyPlans: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/zodiac-info/:author returns empty fields before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/zodiac-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      zodiacInfo: { birthMonth: null, birthDay: null, zodiacSign: null, hideZodiac: false },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/zodiac-info/:author computes the zodiac sign, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/zodiac-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthMonth: 7, birthDay: 4, hideZodiac: true }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), {
      zodiacInfo: { birthMonth: 7, birthDay: 4, zodiacSign: "cancer", hideZodiac: true },
    });

    const getRes = await fetch(`${baseUrl}/api/zodiac-info/alice`);
    assert.deepEqual(await getRes.json(), {
      zodiacInfo: { birthMonth: 7, birthDay: 4, zodiacSign: "cancer", hideZodiac: true },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/zodiac-info/:author rejects an out-of-range month", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/zodiac-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthMonth: 13, birthDay: 1, hideZodiac: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/zodiac-info/:author rejects a day invalid for the given month", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/zodiac-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthMonth: 2, birthDay: 30, hideZodiac: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/languages-info/catalog returns the fixed language catalog", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/languages-info/catalog`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.languages) && body.languages.length > 0);
  } finally {
    server.close();
  }
});

test("GET /api/languages-info/:author returns an empty list before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/languages-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { languagesInfo: { languages: [], hideLanguages: false } });
  } finally {
    server.close();
  }
});

test("PUT /api/languages-info/:author sets languages, then GET returns them", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/languages-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languages: ["english", "spanish"], hideLanguages: true }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), {
      languagesInfo: { languages: ["english", "spanish"], hideLanguages: true },
    });

    const getRes = await fetch(`${baseUrl}/api/languages-info/alice`);
    assert.deepEqual(await getRes.json(), {
      languagesInfo: { languages: ["english", "spanish"], hideLanguages: true },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/languages-info/:author rejects an unknown language", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/languages-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languages: ["klingon"], hideLanguages: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/languages-info/:author rejects more than the max number of languages", async () => {
  const { server, baseUrl } = listen();
  try {
    const catalogRes = await fetch(`${baseUrl}/api/languages-info/catalog`);
    const { languages } = await catalogRes.json();
    const res = await fetch(`${baseUrl}/api/languages-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languages: languages.slice(0, 6), hideLanguages: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/beliefs-info/:author returns empty fields before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/beliefs-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      beliefsInfo: { religion: null, politicalView: null, hideReligion: false, hidePoliticalView: false },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/beliefs-info/:author sets beliefs info, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/beliefs-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ religion: "spiritual", politicalView: "notPolitical", hideReligion: true, hidePoliticalView: false }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), {
      beliefsInfo: { religion: "spiritual", politicalView: "notPolitical", hideReligion: true, hidePoliticalView: false },
    });

    const getRes = await fetch(`${baseUrl}/api/beliefs-info/alice`);
    assert.deepEqual(await getRes.json(), {
      beliefsInfo: { religion: "spiritual", politicalView: "notPolitical", hideReligion: true, hidePoliticalView: false },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/beliefs-info/:author rejects an invalid religion option", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/beliefs-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ religion: "pastafarian", politicalView: "moderate", hideReligion: false, hidePoliticalView: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/beliefs-info/:author rejects an invalid political view option", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/beliefs-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ religion: "buddhist", politicalView: "anarchist", hideReligion: false, hidePoliticalView: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/pets-info/catalog returns the fixed pet catalog", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/pets-info/catalog`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.pets) && body.pets.length > 0);
  } finally {
    server.close();
  }
});

test("GET /api/pets-info/:author returns an empty list before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/pets-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { petsInfo: { pets: [], hidePets: false } });
  } finally {
    server.close();
  }
});

test("PUT /api/pets-info/:author sets pets, then GET returns them", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/pets-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pets: ["dog", "cat"], hidePets: true }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { petsInfo: { pets: ["dog", "cat"], hidePets: true } });

    const getRes = await fetch(`${baseUrl}/api/pets-info/alice`);
    assert.deepEqual(await getRes.json(), { petsInfo: { pets: ["dog", "cat"], hidePets: true } });
  } finally {
    server.close();
  }
});

test("PUT /api/pets-info/:author rejects an unknown pet option", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/pets-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pets: ["dragon"], hidePets: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/pets-info/:author rejects more than the max number of pet options", async () => {
  const { server, baseUrl } = listen();
  try {
    const catalogRes = await fetch(`${baseUrl}/api/pets-info/catalog`);
    const { pets } = await catalogRes.json();
    const res = await fetch(`${baseUrl}/api/pets-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pets: pets.slice(0, 4), hidePets: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/personality-info/:author returns empty fields before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/personality-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      personalityInfo: { mbtiType: null, enneagramType: null, hideMbti: false, hideEnneagram: false },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/personality-info/:author sets personality info, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/personality-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mbtiType: "ENTJ", enneagramType: 8, hideMbti: true, hideEnneagram: false }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), {
      personalityInfo: { mbtiType: "ENTJ", enneagramType: 8, hideMbti: true, hideEnneagram: false },
    });

    const getRes = await fetch(`${baseUrl}/api/personality-info/alice`);
    assert.deepEqual(await getRes.json(), {
      personalityInfo: { mbtiType: "ENTJ", enneagramType: 8, hideMbti: true, hideEnneagram: false },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/personality-info/:author rejects an invalid MBTI type", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/personality-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mbtiType: "XXXX", enneagramType: 4, hideMbti: false, hideEnneagram: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/personality-info/:author rejects an out-of-range enneagram type", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/personality-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mbtiType: "INFP", enneagramType: 10, hideMbti: false, hideEnneagram: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/spotify/connect 503s when Spotify isn't configured", async () => {
  const { server, baseUrl } = listenWithSpotify(new SpotifyService(undefined, undefined, async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/spotify/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", code: "abc", redirectUri: "https://example.com/callback" }),
    });
    assert.equal(res.status, 503);
  } finally {
    server.close();
  }
});

test("POST /api/spotify/connect rejects a missing author", async () => {
  const { server, baseUrl } = listenWithSpotify(
    new SpotifyService("client-id", "client-secret", async () => ({ topTracks: ["Song A"] }))
  );
  try {
    const res = await fetch(`${baseUrl}/api/spotify/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "abc", redirectUri: "https://example.com/callback" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/spotify/connect returns 401 when the fetcher fails", async () => {
  const { server, baseUrl } = listenWithSpotify(new SpotifyService("client-id", "client-secret", async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/spotify/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", code: "bad-code", redirectUri: "https://example.com/callback" }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("POST /api/spotify/connect connects and stores top tracks, then GET/DELETE reflect it", async () => {
  const { server, baseUrl } = listenWithSpotify(
    new SpotifyService("client-id", "client-secret", async () => ({ topTracks: ["Song A — Artist A"] }))
  );
  try {
    const connectRes = await fetch(`${baseUrl}/api/spotify/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", code: "good-code", redirectUri: "https://example.com/callback" }),
    });
    assert.equal(connectRes.status, 200);
    assert.deepEqual(await connectRes.json(), {
      spotifyInfo: { connected: true, topTracks: ["Song A — Artist A"], hideSpotify: false },
    });

    const getRes = await fetch(`${baseUrl}/api/spotify-info/alice`);
    assert.deepEqual(await getRes.json(), {
      spotifyInfo: { connected: true, topTracks: ["Song A — Artist A"], hideSpotify: false },
    });

    const deleteRes = await fetch(`${baseUrl}/api/spotify/alice`, { method: "DELETE" });
    assert.deepEqual(await deleteRes.json(), { spotifyInfo: { connected: false, topTracks: [], hideSpotify: false } });
  } finally {
    server.close();
  }
});

test("PUT /api/spotify-info/:author updates the hide flag", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/spotify-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideSpotify: true }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { spotifyInfo: { connected: false, topTracks: [], hideSpotify: true } });
  } finally {
    server.close();
  }
});

test("POST /api/instagram/connect 503s when Instagram isn't configured", async () => {
  const { server, baseUrl } = listenWithInstagram(new InstagramService(undefined, undefined, async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/instagram/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", code: "abc", redirectUri: "https://example.com/callback" }),
    });
    assert.equal(res.status, 503);
  } finally {
    server.close();
  }
});

test("POST /api/instagram/connect rejects a missing author", async () => {
  const { server, baseUrl } = listenWithInstagram(
    new InstagramService("client-id", "client-secret", async () => ({ posts: ["https://instagram.com/p/1"] }))
  );
  try {
    const res = await fetch(`${baseUrl}/api/instagram/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "abc", redirectUri: "https://example.com/callback" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/instagram/connect returns 401 when the fetcher fails", async () => {
  const { server, baseUrl } = listenWithInstagram(new InstagramService("client-id", "client-secret", async () => undefined));
  try {
    const res = await fetch(`${baseUrl}/api/instagram/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", code: "bad-code", redirectUri: "https://example.com/callback" }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("POST /api/instagram/connect connects and stores posts, then GET/DELETE reflect it", async () => {
  const { server, baseUrl } = listenWithInstagram(
    new InstagramService("client-id", "client-secret", async () => ({ posts: ["https://instagram.com/p/1"] }))
  );
  try {
    const connectRes = await fetch(`${baseUrl}/api/instagram/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", code: "good-code", redirectUri: "https://example.com/callback" }),
    });
    assert.equal(connectRes.status, 200);
    assert.deepEqual(await connectRes.json(), {
      instagramInfo: { connected: true, posts: ["https://instagram.com/p/1"], hideInstagram: false },
    });

    const getRes = await fetch(`${baseUrl}/api/instagram-info/alice`);
    assert.deepEqual(await getRes.json(), {
      instagramInfo: { connected: true, posts: ["https://instagram.com/p/1"], hideInstagram: false },
    });

    const deleteRes = await fetch(`${baseUrl}/api/instagram/alice`, { method: "DELETE" });
    assert.deepEqual(await deleteRes.json(), {
      instagramInfo: { connected: false, posts: [], hideInstagram: false },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/instagram-info/:author updates the hide flag", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/instagram-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideInstagram: true }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { instagramInfo: { connected: false, posts: [], hideInstagram: true } });
  } finally {
    server.close();
  }
});

test("GET /api/interests-info/catalog returns the fixed interest catalog", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/interests-info/catalog`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.interests) && body.interests.length > 0);
  } finally {
    server.close();
  }
});

test("GET /api/interests-info/:author returns an empty list before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/interests-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { interestsInfo: { interests: [], hideInterests: false } });
  } finally {
    server.close();
  }
});

test("PUT /api/interests-info/:author sets interests, then GET returns them", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/interests-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: ["hiking", "yoga"], hideInterests: true }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { interestsInfo: { interests: ["hiking", "yoga"], hideInterests: true } });

    const getRes = await fetch(`${baseUrl}/api/interests-info/alice`);
    assert.deepEqual(await getRes.json(), { interestsInfo: { interests: ["hiking", "yoga"], hideInterests: true } });
  } finally {
    server.close();
  }
});

test("PUT /api/interests-info/:author rejects an unknown interest", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/interests-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: ["timetravel"], hideInterests: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/interests-info/:author rejects more than the max number of interests", async () => {
  const { server, baseUrl } = listen();
  try {
    const catalogRes = await fetch(`${baseUrl}/api/interests-info/catalog`);
    const { interests } = await catalogRes.json();
    const res = await fetch(`${baseUrl}/api/interests-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: interests.slice(0, 11), hideInterests: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/profile-visibility/:author returns defaults before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-visibility/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { visibility: { hideAge: false, hideDistance: false } });
  } finally {
    server.close();
  }
});

test("PUT /api/profile-visibility/:author sets the flags, then GET returns them", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/profile-visibility/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideAge: true, hideDistance: false }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { visibility: { hideAge: true, hideDistance: false } });

    const getRes = await fetch(`${baseUrl}/api/profile-visibility/alice`);
    assert.deepEqual(await getRes.json(), { visibility: { hideAge: true, hideDistance: false } });
  } finally {
    server.close();
  }
});

test("GET /api/profile-preview/:author returns an empty preview when nothing is set", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-preview/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { preview: {} });
  } finally {
    server.close();
  }
});

test("GET /api/profile-preview/:author combines visible fields and omits hidden ones", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/bio/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "Loves hiking" }),
    });
    await fetch(`${baseUrl}/api/job-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle: "Engineer", company: "Acme", hideCompany: true }),
    });
    await fetch(`${baseUrl}/api/height-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heightCm: 170, hideHeight: false }),
    });

    const res = await fetch(`${baseUrl}/api/profile-preview/alice`);
    assert.deepEqual(await res.json(), {
      preview: { bio: "Loves hiking", jobTitle: "Engineer", heightCm: 170 },
    });
  } finally {
    server.close();
  }
});

test("GET /api/profile-visitors/:author returns an empty list before anyone visits", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-visitors/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { visitors: [] });
  } finally {
    server.close();
  }
});

test("GET /api/profile-preview/:author with a ?viewer= records a visit reflected in GET /api/profile-visitors/:author", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/profile-preview/alice?viewer=bob`);

    const res = await fetch(`${baseUrl}/api/profile-visitors/alice`);
    const body = await res.json();
    assert.equal(body.visitors.length, 1);
    assert.equal(body.visitors[0].author, "bob");
  } finally {
    server.close();
  }
});

test("GET /api/profile-preview/:author without ?viewer= does not record a visit", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/profile-preview/alice`);
    const res = await fetch(`${baseUrl}/api/profile-visitors/alice`);
    assert.deepEqual(await res.json(), { visitors: [] });
  } finally {
    server.close();
  }
});

test("GET /api/profile-preview/:author never records a self-visit", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/profile-preview/alice?viewer=alice`);
    const res = await fetch(`${baseUrl}/api/profile-visitors/alice`);
    assert.deepEqual(await res.json(), { visitors: [] });
  } finally {
    server.close();
  }
});

test("POST /api/photos re-encodes an uploaded photo as JPEG (smart optimization)", async () => {
  const { server, baseUrl, photoStore } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });
    assert.equal(res.status, 201);
    const { id } = await res.json();
    const stored = photoStore.get(id);
    assert.equal(stored?.mimeType, "image/jpeg");
    assert.deepEqual(stored?.data.subarray(0, 3), Buffer.from([0xff, 0xd8, 0xff]));
  } finally {
    server.close();
  }
});

test("GET /api/social-links-info/platforms returns the fixed platform list", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/social-links-info/platforms`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.platforms) && body.platforms.length > 0);
  } finally {
    server.close();
  }
});

test("GET /api/social-links-info/:author returns empty links before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/social-links-info/alice`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.socialLinksInfo.links.twitter, "");
    assert.equal(body.socialLinksInfo.hideSocialLinks, false);
  } finally {
    server.close();
  }
});

test("PUT /api/social-links-info/:author sets links, then GET returns them", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/social-links-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        links: { twitter: "https://twitter.com/alice", website: "https://alice.dev" },
        hideSocialLinks: true,
      }),
    });
    assert.equal(putRes.status, 200);
    const putBody = await putRes.json();
    assert.equal(putBody.socialLinksInfo.links.twitter, "https://twitter.com/alice");
    assert.equal(putBody.socialLinksInfo.links.website, "https://alice.dev");
    assert.equal(putBody.socialLinksInfo.hideSocialLinks, true);

    const getRes = await fetch(`${baseUrl}/api/social-links-info/alice`);
    const getBody = await getRes.json();
    assert.equal(getBody.socialLinksInfo.links.twitter, "https://twitter.com/alice");
  } finally {
    server.close();
  }
});

test("PUT /api/social-links-info/:author rejects a non-https URL", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/social-links-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links: { website: "http://example.com" }, hideSocialLinks: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/travel-mode-info/:author returns inactive before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/travel-mode-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { travelModeInfo: { active: false, destination: "" } });
  } finally {
    server.close();
  }
});

test("PUT /api/travel-mode-info/:author sets active travel mode, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/travel-mode-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true, destination: "Tokyo, Japan" }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { travelModeInfo: { active: true, destination: "Tokyo, Japan" } });

    const getRes = await fetch(`${baseUrl}/api/travel-mode-info/alice`);
    assert.deepEqual(await getRes.json(), { travelModeInfo: { active: true, destination: "Tokyo, Japan" } });
  } finally {
    server.close();
  }
});

test("PUT /api/travel-mode-info/:author rejects a destination containing a phone number", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/travel-mode-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true, destination: "call 555-123-4567" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/profile-color-theme/themes returns the fixed theme list", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-color-theme/themes`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.themes) && body.themes.length > 0);
  } finally {
    server.close();
  }
});

test("GET /api/profile-color-theme/:author returns the default theme before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-color-theme/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { theme: "classic" });
  } finally {
    server.close();
  }
});

test("PUT /api/profile-color-theme/:author sets the theme, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/profile-color-theme/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "ocean" }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { theme: "ocean" });

    const getRes = await fetch(`${baseUrl}/api/profile-color-theme/alice`);
    assert.deepEqual(await getRes.json(), { theme: "ocean" });
  } finally {
    server.close();
  }
});

test("PUT /api/profile-color-theme/:author rejects an invalid theme", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-color-theme/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "chartreuse" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/profile-completion/:author is 0% for a brand-new profile", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-completion/alice`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.completion.percentage, 0);
    assert.deepEqual(body.completion.completedSections, []);
  } finally {
    server.close();
  }
});

test("GET /api/profile-completion/:author increases as sections are filled in", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/bio/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "Loves hiking" }),
    });
    await fetch(`${baseUrl}/api/job-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle: "Engineer", company: "Acme", hideCompany: true }),
    });

    const res = await fetch(`${baseUrl}/api/profile-completion/alice`);
    const body = await res.json();
    assert.ok(body.completion.percentage > 0);
    assert.ok(body.completion.completedSections.includes("bio"));
    // A hidden field still counts as complete — completion measures what
    // the owner filled in, not what's currently visible to others.
    assert.ok(body.completion.completedSections.includes("job"));
  } finally {
    server.close();
  }
});

test("GET /api/achievements-info/:author returns an empty list before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/achievements-info/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { achievementsInfo: { achievements: [], hideAchievements: false } });
  } finally {
    server.close();
  }
});

test("PUT /api/achievements-info/:author sets achievements, then GET returns them", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/achievements-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        achievements: [{ title: "MBA", issuer: "State University", year: 2020 }],
        hideAchievements: true,
      }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), {
      achievementsInfo: { achievements: [{ title: "MBA", issuer: "State University", year: 2020 }], hideAchievements: true },
    });

    const getRes = await fetch(`${baseUrl}/api/achievements-info/alice`);
    assert.deepEqual(await getRes.json(), {
      achievementsInfo: { achievements: [{ title: "MBA", issuer: "State University", year: 2020 }], hideAchievements: true },
    });
  } finally {
    server.close();
  }
});

test("PUT /api/achievements-info/:author rejects more than the max number of achievements", async () => {
  const { server, baseUrl } = listen();
  try {
    const achievements = Array.from({ length: 6 }, (_, i) => ({ title: `Award ${i}` }));
    const res = await fetch(`${baseUrl}/api/achievements-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ achievements, hideAchievements: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/achievements-info/:author rejects a title containing a phone number", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/achievements-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ achievements: [{ title: "call 555-123-4567" }], hideAchievements: false }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/display-name-mode/modes returns the fixed mode list", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/display-name-mode/modes`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.modes) && body.modes.length > 0);
  } finally {
    server.close();
  }
});

test("GET /api/display-name-mode/:author returns the default preference before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/display-name-mode/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { preference: { mode: "fullName", nickname: "" } });
  } finally {
    server.close();
  }
});

test("PUT /api/display-name-mode/:author sets the preference, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/display-name-mode/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "nickname", nickname: "Al" }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { preference: { mode: "nickname", nickname: "Al" } });

    const getRes = await fetch(`${baseUrl}/api/display-name-mode/alice`);
    assert.deepEqual(await getRes.json(), { preference: { mode: "nickname", nickname: "Al" } });
  } finally {
    server.close();
  }
});

test("PUT /api/display-name-mode/:author rejects mode nickname with an empty nickname", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/display-name-mode/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "nickname", nickname: "" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/stylized-avatar/styles returns the fixed style list", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/stylized-avatar/styles`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.styles) && body.styles.length > 0);
  } finally {
    server.close();
  }
});

test("GET /api/stylized-avatar/:author returns empty fields before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/stylized-avatar/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { stylizedAvatarInfo: { style: null, active: false } });
  } finally {
    server.close();
  }
});

test("PUT /api/stylized-avatar/:author sets the style, then GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/stylized-avatar/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style: "cartoonA", active: true }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { stylizedAvatarInfo: { style: "cartoonA", active: true } });

    const getRes = await fetch(`${baseUrl}/api/stylized-avatar/alice`);
    assert.deepEqual(await getRes.json(), { stylizedAvatarInfo: { style: "cartoonA", active: true } });
  } finally {
    server.close();
  }
});

test("PUT /api/stylized-avatar/:author rejects activating with no style chosen", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/stylized-avatar/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style: null, active: true }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/discovery/join rejects a missing author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author returns other joined authors, excluding self and blocked", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "carol" }),
    });
    await fetch(`${baseUrl}/api/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice", blockedAuthor: "bob" }),
    });

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.candidates, [{ author: "carol", compatibility: 0 }]);
  } finally {
    server.close();
  }
});

test("POST /api/swipes records a swipe and reports no match for a one-sided like", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "like" }),
    });
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { matched: false });
  } finally {
    server.close();
  }
});

test("POST /api/swipes reports a match on mutual likes, and GET /api/matches reflects it", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "like" }),
    });
    const res = await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "bob", swiped: "alice", direction: "like" }),
    });
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { matched: true });

    const matchesRes = await fetch(`${baseUrl}/api/matches/alice`);
    assert.deepEqual(await matchesRes.json(), { matches: [{ author: "bob", compatibility: 0 }] });
  } finally {
    server.close();
  }
});

test("GET /api/matches/:author includes each match's real interest-compatibility percentage", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/interests-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: ["hiking", "yoga"], hideInterests: false }),
    });
    await fetch(`${baseUrl}/api/interests-info/bob`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: ["hiking", "yoga"], hideInterests: false }),
    });

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

    const res = await fetch(`${baseUrl}/api/matches/alice`);
    assert.deepEqual(await res.json(), { matches: [{ author: "bob", compatibility: 100 }] });
  } finally {
    server.close();
  }
});

test("POST /api/swipes rejects swiping on the same profile twice", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "pass" }),
    });
    const res = await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "like" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/swipes/undo rejects when there's nothing to undo", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/swipes/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/swipes/undo undoes the last swipe and lets it be swiped again", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "pass" }),
    });

    const undoRes = await fetch(`${baseUrl}/api/swipes/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(undoRes.status, 200);
    assert.deepEqual(await undoRes.json(), { swiped: "bob" });

    const reSwipeRes = await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "like" }),
    });
    assert.equal(reSwipeRes.status, 201);
  } finally {
    server.close();
  }
});

test("POST /api/swipes/undo revokes a match that swipe had just created", async () => {
  const { server, baseUrl } = listen();
  try {
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

    await fetch(`${baseUrl}/api/swipes/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });

    const matchesRes = await fetch(`${baseUrl}/api/matches/alice`);
    assert.deepEqual(await matchesRes.json(), { matches: [] });
  } finally {
    server.close();
  }
});

test("GET /api/super-likes-remaining/:author starts at the daily limit", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/super-likes-remaining/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { remaining: 1 });
  } finally {
    server.close();
  }
});

test("POST /api/swipes with direction superlike counts toward a match and decrements the daily allowance", async () => {
  const { server, baseUrl } = listen();
  try {
    const swipeRes = await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "superlike" }),
    });
    assert.equal(swipeRes.status, 201);

    const remainingRes = await fetch(`${baseUrl}/api/super-likes-remaining/alice`);
    assert.deepEqual(await remainingRes.json(), { remaining: 0 });

    const secondSuperlikeRes = await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "carol", direction: "superlike" }),
    });
    assert.equal(secondSuperlikeRes.status, 400);

    const matchRes = await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "bob", swiped: "alice", direction: "like" }),
    });
    assert.deepEqual(await matchRes.json(), { matched: true });
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author includes a real interest-compatibility score and ranks by it", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "carol" }),
    });

    await fetch(`${baseUrl}/api/interests-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: ["hiking", "yoga"], hideInterests: false }),
    });
    // bob shares no interests with alice.
    await fetch(`${baseUrl}/api/interests-info/bob`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: ["gaming"], hideInterests: false }),
    });
    // carol shares both of alice's interests.
    await fetch(`${baseUrl}/api/interests-info/carol`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: ["hiking", "yoga"], hideInterests: false }),
    });

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    const body = await res.json();
    assert.deepEqual(body.candidates, [
      { author: "carol", compatibility: 100 },
      { author: "bob", compatibility: 0 },
    ]);
  } finally {
    server.close();
  }
});

test("GET /api/smart-score/:author returns the default rating and zero activity before any swipes", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/smart-score/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { score: { desirabilityRating: 1500, activityCount: 0 } });
  } finally {
    server.close();
  }
});

test("POST /api/swipes updates the swiped author's smart score and the swiper's activity count", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "like" }),
    });

    const bobScoreRes = await fetch(`${baseUrl}/api/smart-score/bob`);
    const bobScore = (await bobScoreRes.json()).score;
    assert.ok(bobScore.desirabilityRating > 1500);
    assert.equal(bobScore.activityCount, 0);

    const aliceScoreRes = await fetch(`${baseUrl}/api/smart-score/alice`);
    const aliceScore = (await aliceScoreRes.json()).score;
    assert.equal(aliceScore.desirabilityRating, 1500);
    assert.equal(aliceScore.activityCount, 1);
  } finally {
    server.close();
  }
});

test("POST /api/swipes with direction pass lowers the swiped author's smart score", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "pass" }),
    });

    const res = await fetch(`${baseUrl}/api/smart-score/bob`);
    const score = (await res.json()).score;
    assert.ok(score.desirabilityRating < 1500);
  } finally {
    server.close();
  }
});

const EMPTY_DISCOVERY_FILTERS = {
  minHeightCm: null,
  maxHeightCm: null,
  requireEducation: false,
  requiredLanguages: [],
  requireNonSmoking: false,
  allowedDrinking: [],
  requireVerifiedOnly: false,
};

test("GET /api/discovery-filters/:author returns empty filters before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/discovery-filters/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { filters: EMPTY_DISCOVERY_FILTERS });
  } finally {
    server.close();
  }
});

test("PUT /api/discovery-filters/:author saves filters and GET returns them", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/discovery-filters/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minHeightCm: 160,
        maxHeightCm: 190,
        requireEducation: true,
        requiredLanguages: ["english"],
        requireNonSmoking: true,
        allowedDrinking: ["no", "sometimes"],
        requireVerifiedOnly: true,
      }),
    });
    assert.equal(putRes.status, 200);
    const expected = {
      minHeightCm: 160,
      maxHeightCm: 190,
      requireEducation: true,
      requiredLanguages: ["english"],
      requireNonSmoking: true,
      allowedDrinking: ["no", "sometimes"],
      requireVerifiedOnly: true,
    };
    assert.deepEqual(await putRes.json(), { filters: expected });

    const getRes = await fetch(`${baseUrl}/api/discovery-filters/alice`);
    assert.deepEqual(await getRes.json(), { filters: expected });
  } finally {
    server.close();
  }
});

test("PUT /api/discovery-filters/:author rejects an invalid language", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/discovery-filters/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minHeightCm: null,
        maxHeightCm: null,
        requireEducation: false,
        requiredLanguages: ["klingon"],
        requireNonSmoking: false,
        allowedDrinking: [],
      }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/discovery-filters/:author rejects an invalid drinking option", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/discovery-filters/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minHeightCm: null,
        maxHeightCm: null,
        requireEducation: false,
        requiredLanguages: [],
        requireNonSmoking: false,
        allowedDrinking: ["a-lot"],
      }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author excludes candidates that fail the swiper's height filter", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "carol" }),
    });

    await fetch(`${baseUrl}/api/height-info/bob`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heightCm: 160, hideHeight: false }),
    });
    await fetch(`${baseUrl}/api/height-info/carol`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heightCm: 185, hideHeight: false }),
    });

    await fetch(`${baseUrl}/api/discovery-filters/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minHeightCm: 170,
        maxHeightCm: null,
        requireEducation: false,
        requiredLanguages: [],
        requireNonSmoking: false,
        allowedDrinking: [],
      }),
    });

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    const body = await res.json();
    assert.deepEqual(
      body.candidates.map((c: { author: string }) => c.author),
      ["carol"]
    );
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author excludes candidates missing a required language", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });

    await fetch(`${baseUrl}/api/languages-info/bob`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languages: ["spanish"], hideLanguages: false }),
    });

    await fetch(`${baseUrl}/api/discovery-filters/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minHeightCm: null,
        maxHeightCm: null,
        requireEducation: false,
        requiredLanguages: ["french"],
        requireNonSmoking: false,
        allowedDrinking: [],
      }),
    });

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    const body = await res.json();
    assert.deepEqual(body.candidates, []);
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author excludes smokers when requireNonSmoking is set", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "carol" }),
    });

    await fetch(`${baseUrl}/api/lifestyle-info/bob`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smoking: "yes", drinking: null, hideSmoking: false, hideDrinking: false }),
    });
    await fetch(`${baseUrl}/api/lifestyle-info/carol`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smoking: "no", drinking: null, hideSmoking: false, hideDrinking: false }),
    });

    await fetch(`${baseUrl}/api/discovery-filters/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minHeightCm: null,
        maxHeightCm: null,
        requireEducation: false,
        requiredLanguages: [],
        requireNonSmoking: true,
        allowedDrinking: [],
      }),
    });

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    const body = await res.json();
    assert.deepEqual(
      body.candidates.map((c: { author: string }) => c.author),
      ["carol"]
    );
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author excludes candidates outside allowedDrinking", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });

    await fetch(`${baseUrl}/api/lifestyle-info/bob`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smoking: null, drinking: "yes", hideSmoking: false, hideDrinking: false }),
    });

    await fetch(`${baseUrl}/api/discovery-filters/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minHeightCm: null,
        maxHeightCm: null,
        requireEducation: false,
        requiredLanguages: [],
        requireNonSmoking: false,
        allowedDrinking: ["no"],
      }),
    });

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    const body = await res.json();
    assert.deepEqual(body.candidates, []);
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author excludes unverified candidates when requireVerifiedOnly is set", async () => {
  const { server, baseUrl, otpService } = listen();
  try {
    // A candidate whose "author" happens to be their own real, selfie-verified
    // userId (#35) — see discoveryFilters.ts for why requireVerifiedOnly only
    // reflects real verification once a guest author is this account's id.
    const accessToken = await signUpAndGetAccessToken(baseUrl, otpService, "+15551110099");
    const verifiedAuthor = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString()).sub;
    await fetch(`${baseUrl}/api/verification/selfie`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });

    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: verifiedAuthor }),
    });

    await fetch(`${baseUrl}/api/discovery-filters/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minHeightCm: null,
        maxHeightCm: null,
        requireEducation: false,
        requiredLanguages: [],
        requireNonSmoking: false,
        allowedDrinking: [],
        requireVerifiedOnly: true,
      }),
    });

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    const body = await res.json();
    assert.deepEqual(
      body.candidates.map((c: { author: string }) => c.author),
      [verifiedAuthor]
    );
  } finally {
    server.close();
  }
});

test("GET /api/explore-mode/catalog returns the fixed theme list", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/explore-mode/catalog`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { modes: ["cafes", "sports", "travel"] });
  } finally {
    server.close();
  }
});

test("GET /api/explore-mode/:author returns null before any update", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/explore-mode/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { mode: null });
  } finally {
    server.close();
  }
});

test("PUT /api/explore-mode/:author saves a mode and GET returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const putRes = await fetch(`${baseUrl}/api/explore-mode/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "sports" }),
    });
    assert.equal(putRes.status, 200);
    assert.deepEqual(await putRes.json(), { mode: "sports" });

    const getRes = await fetch(`${baseUrl}/api/explore-mode/alice`);
    assert.deepEqual(await getRes.json(), { mode: "sports" });
  } finally {
    server.close();
  }
});

test("PUT /api/explore-mode/:author rejects an invalid mode", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/explore-mode/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "underwater-basket-weaving" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PUT /api/explore-mode/:author accepts null to clear the active mode", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/explore-mode/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "travel" }),
    });
    const res = await fetch(`${baseUrl}/api/explore-mode/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: null }),
    });
    assert.deepEqual(await res.json(), { mode: null });
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author only shows candidates matching the swiper's active explore mode", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "carol" }),
    });

    await fetch(`${baseUrl}/api/interests-info/bob`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: ["gaming"], hideInterests: false }),
    });
    await fetch(`${baseUrl}/api/interests-info/carol`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: ["coffee"], hideInterests: false }),
    });

    await fetch(`${baseUrl}/api/explore-mode/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "cafes" }),
    });

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    const body = await res.json();
    assert.deepEqual(
      body.candidates.map((c: { author: string }) => c.author),
      ["carol"]
    );
  } finally {
    server.close();
  }
});

test("GET /api/top-picks/:author returns an empty list before anyone joins discovery", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/top-picks/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { picks: [] });
  } finally {
    server.close();
  }
});

test("GET /api/top-picks/:author ranks candidates by real desirability rating, excludes blocked candidates, and caches for the day", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "carol" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "dave" }),
    });

    // Someone else's swipe raises bob's real Elo/Smart Score rating above
    // carol's and dave's default 1500, and blocks dave from ever appearing.
    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "someone-else", swiped: "bob", direction: "like" }),
    });
    await fetch(`${baseUrl}/api/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice", blockedAuthor: "dave" }),
    });

    const res = await fetch(`${baseUrl}/api/top-picks/alice`);
    const body = await res.json();
    assert.deepEqual(
      body.picks.map((p: { author: string }) => p.author),
      ["bob", "carol"]
    );
    assert.ok(body.picks[0].desirabilityRating > body.picks[1].desirabilityRating);

    // Requesting again the same day returns the same cached picks even
    // though carol's rating hasn't changed relative to bob's.
    const secondRes = await fetch(`${baseUrl}/api/top-picks/alice`);
    assert.deepEqual(await secondRes.json(), body);
  } finally {
    server.close();
  }
});

test("GET /api/liked-you/:author returns an empty list when nobody has liked this author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/liked-you/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { likedBy: [] });
  } finally {
    server.close();
  }
});

test("GET /api/liked-you/:author lists a real interest-compatibility score for someone who liked but wasn't swiped back, and excludes a blocked liker", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/interests-info/alice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: ["hiking", "yoga"], hideInterests: false }),
    });
    await fetch(`${baseUrl}/api/interests-info/bob`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests: ["hiking", "yoga"], hideInterests: false }),
    });

    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "bob", swiped: "alice", direction: "like" }),
    });
    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "carol", swiped: "alice", direction: "like" }),
    });
    await fetch(`${baseUrl}/api/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice", blockedAuthor: "carol" }),
    });

    const res = await fetch(`${baseUrl}/api/liked-you/alice`);
    assert.deepEqual(await res.json(), { likedBy: [{ author: "bob", compatibility: 100 }] });
  } finally {
    server.close();
  }
});

test("GET /api/liked-you/:author excludes someone once the author swipes back on them", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "bob", swiped: "alice", direction: "like" }),
    });
    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "like" }),
    });

    const res = await fetch(`${baseUrl}/api/liked-you/alice`);
    assert.deepEqual(await res.json(), { likedBy: [] });
  } finally {
    server.close();
  }
});

test("GET /api/profile-boost/:author reports inactive before any activation", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-boost/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { active: false, tier: null, expiresAt: null });
  } finally {
    server.close();
  }
});

test("POST /api/profile-boost/:author activates a boost reflected in GET /api/profile-boost/:author, defaulting to the boost tier", async () => {
  const { server, baseUrl } = listen();
  try {
    const postRes = await fetch(`${baseUrl}/api/profile-boost/alice`, { method: "POST" });
    assert.equal(postRes.status, 201);
    const postBody = await postRes.json();
    assert.equal(postBody.tier, "boost");
    assert.equal(typeof postBody.expiresAt, "string");

    const getRes = await fetch(`${baseUrl}/api/profile-boost/alice`);
    const getBody = await getRes.json();
    assert.equal(getBody.active, true);
    assert.equal(getBody.tier, "boost");
    assert.equal(getBody.expiresAt, postBody.expiresAt);
  } finally {
    server.close();
  }
});

test("POST /api/profile-boost/:author accepts an explicit superboost tier", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-boost/alice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "superboost" }),
    });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).tier, "superboost");
  } finally {
    server.close();
  }
});

test("POST /api/profile-boost/:author rejects an invalid tier", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/profile-boost/alice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "mega-boost" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author ranks a superboosted candidate ahead of a boosted one", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "carol" }),
    });

    await fetch(`${baseUrl}/api/profile-boost/bob`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "boost" }),
    });
    await fetch(`${baseUrl}/api/profile-boost/carol`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "superboost" }),
    });

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    const body = await res.json();
    assert.deepEqual(
      body.candidates.map((c: { author: string }) => c.author),
      ["carol", "bob"]
    );
  } finally {
    server.close();
  }
});

test("GET /api/peak-hours reports no peak hours before any swipe activity", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/peak-hours`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { peakHours: [], isPeakHourNow: false });
  } finally {
    server.close();
  }
});

test("GET /api/peak-hours reflects the current hour as a peak hour after a swipe", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiper: "alice", swiped: "bob", direction: "like" }),
    });

    const res = await fetch(`${baseUrl}/api/peak-hours`);
    const body = await res.json();
    assert.equal(body.isPeakHourNow, true);
    assert.equal(body.peakHours.includes(new Date().getUTCHours()), true);
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author ranks a boosted candidate ahead of a non-boosted one", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "carol" }),
    });

    await fetch(`${baseUrl}/api/profile-boost/carol`, { method: "POST" });

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    const body = await res.json();
    assert.deepEqual(
      body.candidates.map((c: { author: string }) => c.author),
      ["carol", "bob"]
    );
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author excludes a candidate with enough reports against them", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "carol" }),
    });

    for (const reporter of ["r1", "r2", "r3"]) {
      await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporterAuthor: reporter, reportedAuthor: "bob", reason: "fakeProfile" }),
      });
    }

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    const body = await res.json();
    assert.deepEqual(
      body.candidates.map((c: { author: string }) => c.author),
      ["carol"]
    );
  } finally {
    server.close();
  }
});

test("GET /api/swipe-candidates/:author excludes a candidate whose bio matches the spam heuristic", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "carol" }),
    });

    await fetch(`${baseUrl}/api/bio/bob`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "check out my onlyfans" }),
    });

    const res = await fetch(`${baseUrl}/api/swipe-candidates/alice`);
    const body = await res.json();
    assert.deepEqual(
      body.candidates.map((c: { author: string }) => c.author),
      ["carol"]
    );
  } finally {
    server.close();
  }
});

test("GET /api/crossed-paths/:author returns an empty list before anyone's location is recorded", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/crossed-paths/alice`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { crossedPaths: [] });
  } finally {
    server.close();
  }
});

test("GET /api/crossed-paths/:author includes a candidate whose recent location was near the author's", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "carol" }),
    });

    await fetch(`${baseUrl}/api/users/alice/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 40.7128, lng: -74.006 }),
    });
    await fetch(`${baseUrl}/api/users/bob/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 40.713, lng: -74.0062 }),
    });
    await fetch(`${baseUrl}/api/users/carol/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 34.0522, lng: -118.2437 }),
    });

    const res = await fetch(`${baseUrl}/api/crossed-paths/alice`);
    const body = await res.json();
    assert.deepEqual(
      body.crossedPaths.map((c: { author: string }) => c.author),
      ["bob"]
    );
  } finally {
    server.close();
  }
});

test("GET /api/crossed-paths/:author excludes a blocked candidate even if paths crossed", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    await fetch(`${baseUrl}/api/discovery/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob" }),
    });

    await fetch(`${baseUrl}/api/users/alice/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 40.7128, lng: -74.006 }),
    });
    await fetch(`${baseUrl}/api/users/bob/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 40.713, lng: -74.0062 }),
    });

    await fetch(`${baseUrl}/api/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice", blockedAuthor: "bob" }),
    });

    const res = await fetch(`${baseUrl}/api/crossed-paths/alice`);
    assert.deepEqual(await res.json(), { crossedPaths: [] });
  } finally {
    server.close();
  }
});

test("POST /api/squads creates a squad and GET /api/squads/:author returns it", async () => {
  const { server, baseUrl } = listen();
  try {
    const createRes = await fetch(`${baseUrl}/api/squads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: ["alice", "bob"] }),
    });
    assert.equal(createRes.status, 201);
    const createBody = await createRes.json();
    assert.deepEqual(createBody.squad.members, ["alice", "bob"]);

    const getRes = await fetch(`${baseUrl}/api/squads/alice`);
    const getBody = await getRes.json();
    assert.equal(getBody.squad.id, createBody.squad.id);
  } finally {
    server.close();
  }
});

test("POST /api/squads rejects too few members", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/squads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: ["alice"] }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("DELETE /api/squads/:squadId disbands a squad, allowing members to form a new one", async () => {
  const { server, baseUrl } = listen();
  try {
    const createRes = await fetch(`${baseUrl}/api/squads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: ["alice", "bob"] }),
    });
    const squadId = (await createRes.json()).squad.id;

    const deleteRes = await fetch(`${baseUrl}/api/squads/${squadId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(deleteRes.status, 204);

    const recreateRes = await fetch(`${baseUrl}/api/squads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: ["alice", "carol"] }),
    });
    assert.equal(recreateRes.status, 201);
  } finally {
    server.close();
  }
});

test("Two squads mutually liking each other via /api/squad-swipes creates a group match with a shared room", async () => {
  const { server, baseUrl } = listen();
  try {
    const squadARes = await fetch(`${baseUrl}/api/squads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: ["alice", "bob"] }),
    });
    const squadA = (await squadARes.json()).squad.id;

    const squadBRes = await fetch(`${baseUrl}/api/squads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: ["carol", "dave"] }),
    });
    const squadB = (await squadBRes.json()).squad.id;

    await fetch(`${baseUrl}/api/squads/${squadA}/discovery`, { method: "POST" });
    await fetch(`${baseUrl}/api/squads/${squadB}/discovery`, { method: "POST" });

    const candidatesRes = await fetch(`${baseUrl}/api/squad-candidates/${squadA}`);
    assert.deepEqual((await candidatesRes.json()).candidates, [squadB]);

    await fetch(`${baseUrl}/api/squad-swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiperSquadId: squadA, swipedSquadId: squadB, direction: "like" }),
    });
    const matchRes = await fetch(`${baseUrl}/api/squad-swipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swiperSquadId: squadB, swipedSquadId: squadA, direction: "like" }),
    });
    assert.equal(matchRes.status, 201);
    const matchBody = await matchRes.json();
    assert.equal(matchBody.matched, true);
    assert.equal(typeof matchBody.roomId, "string");

    const matchesRes = await fetch(`${baseUrl}/api/squad-matches/${squadA}`);
    assert.deepEqual(await matchesRes.json(), { matches: [{ squadId: squadB, roomId: matchBody.roomId }] });
  } finally {
    server.close();
  }
});
