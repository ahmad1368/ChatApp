import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { TokenService, UserStore } from "./auth";
import { RecoveryCodeService } from "./recovery";

describe("account recovery API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;
  let recoveryCodeService: RecoveryCodeService;

  before(async () => {
    recoveryCodeService = new RecoveryCodeService();
    const { app } = createApp(recoveryCodeService, new UserStore(), new TokenService());
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("rejects an invalid email when requesting a code", async () => {
    const res = await fetch(`${baseUrl}/api/auth/recovery/request-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    assert.equal(res.status, 400);
  });

  it("accepts a valid email and never echoes the code", async () => {
    const res = await fetch(`${baseUrl}/api/auth/recovery/request-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bob@example.com" }),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.code, undefined);
    assert.equal(/\d{6}/.test(JSON.stringify(body)), false);
  });

  it("completes recovery end-to-end and issues tokens", async () => {
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
  });

  it("rejects verification with a wrong code", async () => {
    const email = "dave@example.com";
    recoveryCodeService.requestCode(email);
    const res = await fetch(`${baseUrl}/api/auth/recovery/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: "000000" }),
    });
    assert.equal(res.status, 400);
  });
});
