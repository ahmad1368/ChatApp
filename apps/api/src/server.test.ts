import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { TokenService, UserStore } from "./auth";
import { GoogleAuthService } from "./googleAuth";

async function startServer(googleAuthService: GoogleAuthService) {
  const { app } = createApp(googleAuthService, new UserStore(), new TokenService());
  const httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  return { httpServer, baseUrl: `http://localhost:${port}` };
}

describe("Google sign-in API (unconfigured)", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    ({ httpServer, baseUrl } = await startServer(new GoogleAuthService(undefined, async () => undefined)));
  });
  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("responds 503 when GOOGLE_CLIENT_ID isn't set", async () => {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "anything" }),
    });
    assert.equal(res.status, 503);
  });
});

describe("Google sign-in API (configured)", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    const fakeVerifier = async (idToken: string) =>
      idToken === "valid-token" ? { googleId: "g-1", email: "a@b.com", name: "Alice" } : undefined;
    ({ httpServer, baseUrl } = await startServer(new GoogleAuthService("client-id", fakeVerifier)));
  });
  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("requires an idToken", async () => {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it("rejects an invalid token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "garbage" }),
    });
    assert.equal(res.status, 401);
  });

  it("signs a user in and issues tokens for a valid token", async () => {
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
  });

  it("returns the same user id on repeat sign-in", async () => {
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
  });
});
