import { test } from "node:test";
import assert from "node:assert/strict";
import { InstagramService } from "./instagramAuth";

test("isConfigured() is false when no credentials are provided", () => {
  const service = new InstagramService(undefined, undefined, async () => undefined);
  assert.equal(service.isConfigured(), false);
});

test("isConfigured() is true when both client id and secret are provided", () => {
  const service = new InstagramService("client-id", "client-secret", async () => undefined);
  assert.equal(service.isConfigured(), true);
});

test("fetchLatestPosts() returns undefined when not configured", async () => {
  const service = new InstagramService(undefined, undefined, async () => ({ posts: ["https://instagram.com/p/1"] }));
  const result = await service.fetchLatestPosts("some-code", "https://example.com/callback");
  assert.equal(result, undefined);
});

test("fetchLatestPosts() returns undefined when the injected fetcher fails", async () => {
  const service = new InstagramService("client-id", "client-secret", async () => undefined);
  const result = await service.fetchLatestPosts("bad-code", "https://example.com/callback");
  assert.equal(result, undefined);
});

test("fetchLatestPosts() returns the fetcher's posts when configured and successful", async () => {
  const service = new InstagramService("client-id", "client-secret", async () => ({
    posts: ["https://instagram.com/p/1", "https://instagram.com/p/2"],
  }));
  const result = await service.fetchLatestPosts("good-code", "https://example.com/callback");
  assert.deepEqual(result, { posts: ["https://instagram.com/p/1", "https://instagram.com/p/2"] });
});

test("fetchLatestPosts() passes the code, redirect uri, and credentials through to the fetcher", async () => {
  let received: unknown;
  const service = new InstagramService("client-id", "client-secret", async (code, redirectUri, credentials) => {
    received = { code, redirectUri, credentials };
    return { posts: [] };
  });
  await service.fetchLatestPosts("the-code", "https://example.com/callback");
  assert.deepEqual(received, {
    code: "the-code",
    redirectUri: "https://example.com/callback",
    credentials: { clientId: "client-id", clientSecret: "client-secret" },
  });
});
