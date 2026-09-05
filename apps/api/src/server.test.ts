import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { TokenService } from "./auth";
import { WebAuthnService } from "./webauthn";

describe("WebAuthn API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    const webAuthnService = new WebAuthnService({ rpId: "localhost", origin: "http://localhost:3000" });
    const { app } = createApp(webAuthnService, new TokenService());
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("requires userId and username to begin registration", async () => {
    const res = await fetch(`${baseUrl}/api/auth/webauthn/register/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it("returns registration options with a challenge for a valid request", async () => {
    const res = await fetch(`${baseUrl}/api/auth/webauthn/register/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", username: "alice" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.challenge);
  });

  it("rejects registration verification with a garbage response", async () => {
    const res = await fetch(`${baseUrl}/api/auth/webauthn/register/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", response: { id: "not-real" } }),
    });
    assert.equal(res.status, 400);
  });

  it("returns 404 for login options when the user has no credentials", async () => {
    const res = await fetch(`${baseUrl}/api/auth/webauthn/login/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "no-such-user" }),
    });
    assert.equal(res.status, 404);
  });

  it("reports no credentials via the status endpoint for a fresh user", async () => {
    const res = await fetch(`${baseUrl}/api/auth/webauthn/status/brand-new-user`);
    const body = await res.json();
    assert.equal(body.hasCredentials, false);
  });

  it("rejects a refresh with an unknown token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "not-a-real-token" }),
    });
    assert.equal(res.status, 401);
  });
});
