import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authenticator } from "otplib";
import { TwoFactorService } from "./twoFactor";

describe("TwoFactorService", () => {
  it("is not enabled until setup is confirmed", async () => {
    const service = new TwoFactorService();
    await service.beginSetup("user-1", "alice@example.com");
    assert.equal(service.isEnabled("user-1"), false);
  });

  it("confirms setup with a valid code and enables 2FA", async () => {
    const service = new TwoFactorService();
    const { secret } = await service.beginSetup("user-1", "alice@example.com");
    const validCode = authenticator.generate(secret);

    assert.equal(service.confirmSetup("user-1", validCode), true);
    assert.equal(service.isEnabled("user-1"), true);
  });

  it("rejects confirming setup with a wrong code", async () => {
    const service = new TwoFactorService();
    await service.beginSetup("user-1", "alice@example.com");
    assert.equal(service.confirmSetup("user-1", "000000"), false);
    assert.equal(service.isEnabled("user-1"), false);
  });

  it("verifies a correct code at login time once enabled", async () => {
    const service = new TwoFactorService();
    const { secret } = await service.beginSetup("user-1", "alice@example.com");
    service.confirmSetup("user-1", authenticator.generate(secret));

    assert.equal(service.verify("user-1", authenticator.generate(secret)), true);
  });

  it("rejects verification for a user who never enabled 2FA", () => {
    const service = new TwoFactorService();
    assert.equal(service.verify("unknown-user", "123456"), false);
  });

  it("locks out after too many wrong verify attempts", async () => {
    const service = new TwoFactorService();
    const { secret } = await service.beginSetup("user-1", "alice@example.com");
    service.confirmSetup("user-1", authenticator.generate(secret));

    for (let i = 0; i < 5; i++) service.verify("user-1", "000000");
    // Even the correct code should now be rejected until some future
    // recovery step (out of scope here) resets the attempt counter.
    assert.equal(service.verify("user-1", authenticator.generate(secret)), false);
  });

  it("forgets everything after disable()", async () => {
    const service = new TwoFactorService();
    const { secret } = await service.beginSetup("user-1", "alice@example.com");
    service.confirmSetup("user-1", authenticator.generate(secret));
    service.disable("user-1");
    assert.equal(service.isEnabled("user-1"), false);
  });
});
