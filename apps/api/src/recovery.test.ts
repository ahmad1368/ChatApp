import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeEmail, RecoveryCodeService } from "./recovery";

describe("normalizeEmail", () => {
  it("lowercases and trims a plausible address", () => {
    assert.equal(normalizeEmail("  Alice@Example.com  "), "alice@example.com");
  });

  it("rejects malformed input", () => {
    assert.equal(normalizeEmail("not-an-email"), undefined);
    assert.equal(normalizeEmail(""), undefined);
    assert.equal(normalizeEmail(undefined), undefined);
  });
});

describe("RecoveryCodeService", () => {
  it("verifies a freshly requested code and invalidates it after use", () => {
    const service = new RecoveryCodeService();
    const requested = service.requestCode("alice@example.com");
    assert.ok("code" in requested);
    const code = (requested as { code: string }).code;

    assert.deepEqual(service.verifyCode("alice@example.com", code), { success: true });
    assert.deepEqual(service.verifyCode("alice@example.com", code), { success: false, error: "invalid" });
  });

  it("rejects a wrong code", () => {
    const service = new RecoveryCodeService();
    service.requestCode("alice@example.com");
    assert.deepEqual(service.verifyCode("alice@example.com", "000000"), { success: false, error: "invalid" });
  });

  it("enforces a resend cooldown", () => {
    const service = new RecoveryCodeService();
    service.requestCode("alice@example.com");
    const second = service.requestCode("alice@example.com");
    assert.ok("error" in second);
    assert.equal((second as { error: string }).error, "cooldown");
  });

  it("locks out after too many wrong attempts", () => {
    const service = new RecoveryCodeService();
    service.requestCode("alice@example.com");
    for (let i = 0; i < 5; i++) service.verifyCode("alice@example.com", "000000");
    assert.deepEqual(service.verifyCode("alice@example.com", "000000"), { success: false, error: "too_many_attempts" });
  });
});
