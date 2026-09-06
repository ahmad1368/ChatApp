import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WebAuthnService } from "./webauthn";

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
