import { test } from "node:test";
import assert from "node:assert/strict";
import { SpotifyService } from "./spotifyAuth";

test("isConfigured() is false when no credentials are provided", () => {
  const service = new SpotifyService(undefined, undefined, async () => undefined);
  assert.equal(service.isConfigured(), false);
});

test("isConfigured() is true when both client id and secret are provided", () => {
  const service = new SpotifyService("client-id", "client-secret", async () => undefined);
  assert.equal(service.isConfigured(), true);
});

test("fetchTopTracks() returns undefined when not configured", async () => {
  const service = new SpotifyService(undefined, undefined, async () => ({ topTracks: ["Song A"] }));
  const result = await service.fetchTopTracks("some-code", "https://example.com/callback");
  assert.equal(result, undefined);
});

test("fetchTopTracks() returns undefined when the injected fetcher fails", async () => {
  const service = new SpotifyService("client-id", "client-secret", async () => undefined);
  const result = await service.fetchTopTracks("bad-code", "https://example.com/callback");
  assert.equal(result, undefined);
});

test("fetchTopTracks() returns the fetcher's top tracks when configured and successful", async () => {
  const service = new SpotifyService("client-id", "client-secret", async () => ({
    topTracks: ["Song A — Artist A", "Song B — Artist B"],
  }));
  const result = await service.fetchTopTracks("good-code", "https://example.com/callback");
  assert.deepEqual(result, { topTracks: ["Song A — Artist A", "Song B — Artist B"] });
});

test("fetchTopTracks() passes the code, redirect uri, and credentials through to the fetcher", async () => {
  let received: unknown;
  const service = new SpotifyService("client-id", "client-secret", async (code, redirectUri, credentials) => {
    received = { code, redirectUri, credentials };
    return { topTracks: [] };
  });
  await service.fetchTopTracks("the-code", "https://example.com/callback");
  assert.deepEqual(received, {
    code: "the-code",
    redirectUri: "https://example.com/callback",
    credentials: { clientId: "client-id", clientSecret: "client-secret" },
  });
});
