import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePhoneNumber, OtpService, TokenService, UserStore } from "./auth";

describe("normalizePhoneNumber", () => {
  it("accepts a plausible E.164-ish number", () => {
    assert.equal(normalizePhoneNumber("+15551234567"), "+15551234567");
  });

  it("rejects letters, empty strings, and obviously-too-short input", () => {
    assert.equal(normalizePhoneNumber("not-a-phone"), undefined);
    assert.equal(normalizePhoneNumber(""), undefined);
    assert.equal(normalizePhoneNumber("123"), undefined);
    assert.equal(normalizePhoneNumber(undefined), undefined);
  });
});

describe("OtpService", () => {
  it("verifies a freshly requested code and then invalidates it (one-time use)", () => {
    const otp = new OtpService();
    const requested = otp.requestOtp("+15551234567");
    assert.ok("code" in requested);
    const code = (requested as { code: string }).code;

    assert.deepEqual(otp.verifyOtp("+15551234567", code), { success: true });
    // Reusing the same code should fail now that it's consumed.
    assert.deepEqual(otp.verifyOtp("+15551234567", code), { success: false, error: "invalid" });
  });

  it("rejects a wrong code without revealing the right one", () => {
    const otp = new OtpService();
    otp.requestOtp("+15551234567");
    assert.deepEqual(otp.verifyOtp("+15551234567", "000000"), { success: false, error: "invalid" });
  });

  it("enforces a resend cooldown", () => {
    const otp = new OtpService();
    otp.requestOtp("+15551234567");
    const second = otp.requestOtp("+15551234567");
    assert.ok("error" in second);
    assert.equal((second as { error: string }).error, "cooldown");
  });

  it("locks out after too many wrong attempts", () => {
    const otp = new OtpService();
    otp.requestOtp("+15551234567");
    for (let i = 0; i < 5; i++) {
      otp.verifyOtp("+15551234567", "000000");
    }
    const result = otp.verifyOtp("+15551234567", "000000");
    assert.deepEqual(result, { success: false, error: "too_many_attempts" });
  });
});

describe("UserStore", () => {
  it("creates a user once and returns the same one on repeat calls", () => {
    const store = new UserStore();
    const first = store.findOrCreate("+15551234567");
    const second = store.findOrCreate("+15551234567");
    assert.equal(first.id, second.id);
    assert.equal(first.displayName, "Guest 4567");
  });
});

describe("TokenService", () => {
  it("issues an access token that verifies back to the same user", () => {
    const tokens = new TokenService();
    const { accessToken } = tokens.issueTokens("user-1");
    assert.deepEqual(tokens.verifyAccessToken(accessToken), { userId: "user-1" });
  });

  it("rejects a garbage access token", () => {
    const tokens = new TokenService();
    assert.equal(tokens.verifyAccessToken("not-a-real-token"), undefined);
  });

  it("rotates the refresh token and rejects reuse of the old one", () => {
    const tokens = new TokenService();
    const issued = tokens.issueTokens("user-1");
    const refreshed = tokens.refresh(issued.refreshToken);
    assert.ok(refreshed);
    assert.notEqual(refreshed!.refreshToken, issued.refreshToken);
    assert.equal(tokens.refresh(issued.refreshToken), undefined);
  });
});
