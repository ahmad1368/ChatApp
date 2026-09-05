import { test } from "node:test";
import assert from "node:assert/strict";
import { WebAuthnStore } from "./webauthn";

// A full WebAuthn ceremony (real attestation/assertion signatures) can only be
// produced by a real authenticator or a WebDriver virtual authenticator, so
// these tests cover the store's own business logic — challenge lifecycle,
// authorization, and error handling — rather than faking cryptography.

test("isRegistered() is false until a credential is stored", () => {
  const store = new WebAuthnStore();
  assert.equal(store.isRegistered("alice"), false);
});

test("createRegistrationOptions() rejects a missing author", async () => {
  const store = new WebAuthnStore();
  const result = await store.createRegistrationOptions("");
  assert.equal(result.success, false);
});

test("createRegistrationOptions() returns a challenge scoped to platform biometrics", async () => {
  const store = new WebAuthnStore();
  const result = await store.createRegistrationOptions("alice");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.ok(result.options.challenge);
  assert.equal(result.options.authenticatorSelection?.authenticatorAttachment, "platform");
  assert.equal(result.options.authenticatorSelection?.userVerification, "required");
});

test("verifyRegistration() rejects when there's no pending challenge for the author", async () => {
  const store = new WebAuthnStore();
  const result = await store.verifyRegistration("alice", {});
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /no pending registration/i);
});

test("verifyRegistration() rejects a malformed response without crashing", async () => {
  const store = new WebAuthnStore();
  await store.createRegistrationOptions("alice");
  const result = await store.verifyRegistration("alice", { garbage: true });
  assert.equal(result.success, false);
});

test("createAuthenticationOptions() rejects an author with no registered credential", async () => {
  const store = new WebAuthnStore();
  const result = await store.createAuthenticationOptions("alice");
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /no biometric credential/i);
});

test("verifyAuthentication() rejects when there's no pending challenge", async () => {
  const store = new WebAuthnStore();
  const result = await store.verifyAuthentication("alice", {});
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /no pending authentication/i);
});
