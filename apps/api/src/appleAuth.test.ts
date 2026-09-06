import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppleAuthService, AppleIdTokenVerifier } from "./appleAuth";

describe("AppleAuthService", () => {
  it("reports unconfigured when no services id is set", () => {
    const service = new AppleAuthService(undefined, async () => undefined);
    assert.equal(service.isConfigured(), false);
  });

  it("reports configured once a services id is set", () => {
    const service = new AppleAuthService("com.example.app.web", async () => undefined);
    assert.equal(service.isConfigured(), true);
  });

  it("returns undefined without calling the verifier when unconfigured", async () => {
    let called = false;
    const verifier: AppleIdTokenVerifier = async () => {
      called = true;
      return { appleId: "001" };
    };
    const service = new AppleAuthService(undefined, verifier);
    assert.equal(await service.verify("some-token"), undefined);
    assert.equal(called, false);
  });

  it("passes the token and configured services id through to the verifier", async () => {
    let receivedArgs: [string, string] | undefined;
    const verifier: AppleIdTokenVerifier = async (idToken, clientId) => {
      receivedArgs = [idToken, clientId];
      return { appleId: "apple-001", email: "a@privaterelay.appleid.com" };
    };
    const service = new AppleAuthService("com.example.app.web", verifier);
    const profile = await service.verify("id-token-xyz");
    assert.deepEqual(receivedArgs, ["id-token-xyz", "com.example.app.web"]);
    assert.deepEqual(profile, { appleId: "apple-001", email: "a@privaterelay.appleid.com" });
  });

  it("propagates a verification failure as undefined", async () => {
    const service = new AppleAuthService("com.example.app.web", async () => undefined);
    assert.equal(await service.verify("bad-token"), undefined);
  });
});
