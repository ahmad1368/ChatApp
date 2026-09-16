import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FacebookAuthService, FacebookTokenVerifier } from "./facebookAuth";

describe("FacebookAuthService", () => {
  it("reports unconfigured when either credential is missing", () => {
    assert.equal(new FacebookAuthService(undefined, undefined, async () => undefined).isConfigured(), false);
    assert.equal(new FacebookAuthService("app-id", undefined, async () => undefined).isConfigured(), false);
    assert.equal(new FacebookAuthService(undefined, "app-secret", async () => undefined).isConfigured(), false);
  });

  it("reports configured once both credentials are set", () => {
    const service = new FacebookAuthService("app-id", "app-secret", async () => undefined);
    assert.equal(service.isConfigured(), true);
  });

  it("returns undefined without calling the verifier when unconfigured", async () => {
    let called = false;
    const verifier: FacebookTokenVerifier = async () => {
      called = true;
      return { facebookId: "1" };
    };
    const service = new FacebookAuthService(undefined, undefined, verifier);
    assert.equal(await service.verify("some-token"), undefined);
    assert.equal(called, false);
  });

  it("passes the token and credentials through to the verifier", async () => {
    let received: unknown;
    const verifier: FacebookTokenVerifier = async (token, credentials) => {
      received = { token, credentials };
      return { facebookId: "fb-1", email: "a@b.com", name: "Alice" };
    };
    const service = new FacebookAuthService("app-id", "app-secret", verifier);
    const profile = await service.verify("user-token");
    assert.deepEqual(received, { token: "user-token", credentials: { appId: "app-id", appSecret: "app-secret" } });
    assert.deepEqual(profile, { facebookId: "fb-1", email: "a@b.com", name: "Alice" });
  });

  it("propagates a verification failure as undefined", async () => {
    const service = new FacebookAuthService("app-id", "app-secret", async () => undefined);
    assert.equal(await service.verify("bad-token"), undefined);
  });

  it("fetchFriends returns [] without calling the fetcher when unconfigured", async () => {
    let called = false;
    const friendsFetcher = async () => {
      called = true;
      return ["1", "2"];
    };
    const service = new FacebookAuthService(undefined, undefined, async () => undefined, friendsFetcher);
    assert.deepEqual(await service.fetchFriends("some-token"), []);
    assert.equal(called, false);
  });

  it("fetchFriends passes the token through to the friends fetcher", async () => {
    let received: unknown;
    const friendsFetcher = async (token: string) => {
      received = token;
      return ["fb-2", "fb-3"];
    };
    const service = new FacebookAuthService("app-id", "app-secret", async () => undefined, friendsFetcher);
    const friends = await service.fetchFriends("user-token");
    assert.equal(received, "user-token");
    assert.deepEqual(friends, ["fb-2", "fb-3"]);
  });
});
