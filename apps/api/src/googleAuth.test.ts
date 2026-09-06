import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GoogleAuthService, GoogleIdTokenVerifier } from "./googleAuth";

describe("GoogleAuthService", () => {
  it("reports unconfigured when no client id is set", () => {
    const service = new GoogleAuthService(undefined, async () => undefined);
    assert.equal(service.isConfigured(), false);
  });

  it("reports configured once a client id is set", () => {
    const service = new GoogleAuthService("test-client-id", async () => undefined);
    assert.equal(service.isConfigured(), true);
  });

  it("returns undefined without calling the verifier when unconfigured", async () => {
    let called = false;
    const verifier: GoogleIdTokenVerifier = async () => {
      called = true;
      return { googleId: "123" };
    };
    const service = new GoogleAuthService(undefined, verifier);
    const result = await service.verify("some-token");
    assert.equal(result, undefined);
    assert.equal(called, false);
  });

  it("passes the token and configured client id through to the verifier", async () => {
    let receivedArgs: [string, string] | undefined;
    const verifier: GoogleIdTokenVerifier = async (idToken, clientId) => {
      receivedArgs = [idToken, clientId];
      return { googleId: "google-123", email: "a@b.com", name: "Alice" };
    };
    const service = new GoogleAuthService("client-abc", verifier);
    const profile = await service.verify("id-token-xyz");
    assert.deepEqual(receivedArgs, ["id-token-xyz", "client-abc"]);
    assert.deepEqual(profile, { googleId: "google-123", email: "a@b.com", name: "Alice" });
  });

  it("propagates a verification failure as undefined", async () => {
    const service = new GoogleAuthService("client-abc", async () => undefined);
    assert.equal(await service.verify("bad-token"), undefined);
  });
});
