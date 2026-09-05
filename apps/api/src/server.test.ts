import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { authenticator } from "otplib";
import { createApp } from "./server";
import { TwoFactorService } from "./twoFactor";

describe("2FA API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;
  let twoFactorService: TwoFactorService;

  before(async () => {
    twoFactorService = new TwoFactorService();
    const { app } = createApp(twoFactorService);
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("requires userId and accountLabel to begin setup", async () => {
    const res = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it("completes setup, confirm, and login-verify end-to-end", async () => {
    const setupRes = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", accountLabel: "alice@example.com" }),
    });
    assert.equal(setupRes.status, 200);
    const { secret, qrCodeDataUrl } = await setupRes.json();
    assert.ok(secret);
    assert.match(qrCodeDataUrl, /^data:image\/png;base64,/);

    const statusBefore = await fetch(`${baseUrl}/api/auth/2fa/status/user-1`).then((r) => r.json());
    assert.equal(statusBefore.enabled, false);

    const confirmRes = await fetch(`${baseUrl}/api/auth/2fa/confirm-setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", token: authenticator.generate(secret) }),
    });
    assert.equal(confirmRes.status, 200);

    const statusAfter = await fetch(`${baseUrl}/api/auth/2fa/status/user-1`).then((r) => r.json());
    assert.equal(statusAfter.enabled, true);

    const verifyRes = await fetch(`${baseUrl}/api/auth/2fa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", token: authenticator.generate(secret) }),
    });
    assert.equal(verifyRes.status, 200);
  });

  it("rejects verification with a wrong code", async () => {
    await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2", accountLabel: "bob@example.com" }),
    }).then((r) => r.json());

    const res = await fetch(`${baseUrl}/api/auth/2fa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2", token: "000000" }),
    });
    assert.equal(res.status, 401);
  });

  it("disables 2FA", async () => {
    const setupRes = await fetch(`${baseUrl}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-3", accountLabel: "carol@example.com" }),
    }).then((r) => r.json());
    await fetch(`${baseUrl}/api/auth/2fa/confirm-setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-3", token: authenticator.generate(setupRes.secret) }),
    });

    const disableRes = await fetch(`${baseUrl}/api/auth/2fa/disable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-3" }),
    });
    assert.equal(disableRes.status, 200);

    const status = await fetch(`${baseUrl}/api/auth/2fa/status/user-3`).then((r) => r.json());
    assert.equal(status.enabled, false);
  });
});
