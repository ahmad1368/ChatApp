import { test } from "node:test";
import assert from "node:assert/strict";
import { RecaptchaService } from "./recaptcha";

test("isConfigured() is false with no secret key", () => {
  const service = new RecaptchaService(undefined);
  assert.equal(service.isConfigured(), false);
});

test("isConfigured() is true with a secret key", () => {
  const service = new RecaptchaService("test-secret");
  assert.equal(service.isConfigured(), true);
});

test("verify() skips the check entirely when unconfigured", async () => {
  const service = new RecaptchaService(undefined, async () => false);
  assert.equal(await service.verify(undefined), true);
});

test("verify() rejects a missing token when configured", async () => {
  const service = new RecaptchaService("test-secret", async () => true);
  assert.equal(await service.verify(undefined), false);
});

test("verify() delegates to the injected verifier with the configured secret", async () => {
  let receivedSecret: string | undefined;
  const service = new RecaptchaService("test-secret", async (token, secret) => {
    receivedSecret = secret;
    return token === "good-token";
  });
  assert.equal(await service.verify("good-token"), true);
  assert.equal(receivedSecret, "test-secret");
  assert.equal(await service.verify("bad-token"), false);
});
