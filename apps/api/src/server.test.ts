import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { TokenService, UserStore } from "./auth";
import { FacebookAuthService } from "./facebookAuth";

async function startServer(facebookAuthService: FacebookAuthService) {
  const { app } = createApp(facebookAuthService, new UserStore(), new TokenService());
  const httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  return { httpServer, baseUrl: `http://localhost:${port}` };
}

describe("Facebook sign-in API (unconfigured)", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    ({ httpServer, baseUrl } = await startServer(new FacebookAuthService(undefined, undefined, async () => undefined)));
  });
  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("responds 503 when FACEBOOK_APP_ID/SECRET aren't set", async () => {
    const res = await fetch(`${baseUrl}/api/auth/facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "anything" }),
    });
    assert.equal(res.status, 503);
  });
});

describe("Facebook sign-in API (configured)", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    const fakeVerifier = async (token: string) =>
      token === "valid-token" ? { facebookId: "fb-1", email: "a@b.com", name: "Alice" } : undefined;
    ({ httpServer, baseUrl } = await startServer(new FacebookAuthService("app-id", "app-secret", fakeVerifier)));
  });
  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("requires an accessToken", async () => {
    const res = await fetch(`${baseUrl}/api/auth/facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it("rejects an invalid token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "garbage" }),
    });
    assert.equal(res.status, 401);
  });

  it("signs a user in and issues tokens for a valid token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "valid-token" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.email, "a@b.com");
    assert.ok(body.tokens.accessToken);
  });

  it("returns the same user id on repeat sign-in", async () => {
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
  });
});
