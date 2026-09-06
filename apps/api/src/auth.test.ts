import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeUserAgent, normalizePhoneNumber, OtpService, TokenService, UserStore } from "./auth";

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
    const verified = tokens.verifyAccessToken(accessToken);
    assert.equal(verified?.userId, "user-1");
    assert.ok(verified?.sessionId);
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

  it("lists a session for each sign-in, labeled with the given device", () => {
    const tokens = new TokenService();
    tokens.issueTokens("user-1", "Chrome on Windows");
    tokens.issueTokens("user-1", "Safari on iOS");
    const sessions = tokens.listSessions("user-1");
    assert.equal(sessions.length, 2);
    assert.deepEqual(
      sessions.map((s) => s.deviceLabel).sort(),
      ["Chrome on Windows", "Safari on iOS"]
    );
  });

  it("refreshing a token keeps the same session instead of creating a new one", () => {
    const tokens = new TokenService();
    const issued = tokens.issueTokens("user-1", "Chrome on Windows");
    tokens.refresh(issued.refreshToken);
    assert.equal(tokens.listSessions("user-1").length, 1);
  });

  it("revokeSession() invalidates that session's refresh token and only works for its own user", () => {
    const tokens = new TokenService();
    const issued = tokens.issueTokens("user-1", "Chrome on Windows");
    const [session] = tokens.listSessions("user-1");

    assert.equal(tokens.revokeSession("someone-else", session.id), false);
    assert.equal(tokens.revokeSession("user-1", session.id), true);
    assert.equal(tokens.refresh(issued.refreshToken), undefined);
    assert.equal(tokens.listSessions("user-1").length, 0);
  });

  it("revokeOtherSessions() logs out every device but the caller's own", () => {
    const tokens = new TokenService();
    const current = tokens.issueTokens("user-1", "Chrome on Windows");
    tokens.issueTokens("user-1", "Safari on iOS");
    tokens.issueTokens("user-1", "Firefox on Linux");
    const currentSessionId = tokens.verifyAccessToken(current.accessToken)?.sessionId ?? "";

    const revokedCount = tokens.revokeOtherSessions("user-1", currentSessionId);
    assert.equal(revokedCount, 2);

    const remaining = tokens.listSessions("user-1");
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, currentSessionId);
  });
});

describe("describeUserAgent", () => {
  it("parses a Chrome-on-Windows desktop user agent", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
    assert.equal(describeUserAgent(ua), "Chrome on Windows");
  });

  it("parses a Safari-on-iPhone mobile user agent", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
    assert.equal(describeUserAgent(ua), "Safari on iOS (mobile)");
  });

  it("falls back to Unknown device when no user agent is given", () => {
    assert.equal(describeUserAgent(undefined), "Unknown device");
  });
});
