import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { OtpService, UserStore, TokenService } from "./auth";

describe("auth API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;
  let otpService: OtpService;

  before(async () => {
    otpService = new OtpService();
    const { app } = createApp(otpService, new UserStore(), new TokenService());
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("rejects an invalid phone number when requesting an OTP", async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: "abc" }),
    });
    assert.equal(res.status, 400);
  });

  it("accepts a valid phone number and never echoes the code back", async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: "+15557654321" }),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.equal(body.code, undefined);
    assert.equal(/\d{6}/.test(JSON.stringify(body)), false);
  });

  it("completes signup end-to-end and issues tokens", async () => {
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
  });

  it("rejects verification with a wrong code", async () => {
    const phoneNumber = "+15551112222";
    otpService.requestOtp(phoneNumber);

    const res = await fetch(`${baseUrl}/api/auth/signup/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code: "000000" }),
    });
    assert.equal(res.status, 400);
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
