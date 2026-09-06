import assert from "node:assert/strict";
import { describe, it, test } from "node:test";
import { WebAuthnService, WebAuthnStore } from "./webauthn";

// Full registration/authentication requires a real platform authenticator
// (or a simulated one) to produce a validly-signed attestation/assertion —
// that cryptographic verification is @simplewebauthn/server's own tested
// responsibility. These tests cover this service's wiring: challenge
// issuance/storage, credential lookup, and fail-closed behavior when
// something doesn't line up.

function service() {
  return new WebAuthnService({ rpId: "localhost", origin: "http://localhost:3000" });
}

describe("WebAuthnService", () => {
  it("generates registration options with a stored challenge", async () => {
    const svc = service();
    const options = await svc.generateRegistrationOptions("user-1", "alice");
    assert.ok(options.challenge);
    assert.equal(options.rp.id, "localhost");
    assert.equal(options.user.name, "alice");
  });

  it("rejects registration verification without a matching pending challenge", async () => {
    const svc = service();
    // Never called generateRegistrationOptions for this user, so there's no
    // challenge to check the (garbage) response against.
    const verified = await svc.verifyRegistration("user-1", {} as never);
    assert.equal(verified, false);
  });

  it("rejects a malformed registration response even with a pending challenge", async () => {
    const svc = service();
    await svc.generateRegistrationOptions("user-1", "alice");
    const verified = await svc.verifyRegistration("user-1", { id: "not-real" } as never);
    assert.equal(verified, false);
  });

  it("reports no credentials for a user who never registered one", () => {
    const svc = service();
    assert.equal(svc.hasCredentials("user-1"), false);
  });

  it("returns undefined for authentication options when the user has no credentials", async () => {
    const svc = service();
    assert.equal(await svc.generateAuthenticationOptions("user-1"), undefined);
  });

  it("rejects authentication verification for an unregistered credential id", async () => {
    const svc = service();
    const verified = await svc.verifyAuthentication("user-1", { id: "unknown-credential" } as never);
    assert.equal(verified, false);
  });
});

// WebAuthnStore: the separate, author-keyed store backing the app-lock
// screen (#49), distinct from WebAuthnService above (userId-keyed login).
// A full WebAuthn ceremony (real attestation/assertion signatures) can only
// be produced by a real authenticator or a WebDriver virtual authenticator,
// so these tests cover the store's own business logic — challenge
// lifecycle, authorization, and error handling — rather than faking
// cryptography.

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
