import { test } from "node:test";
import assert from "node:assert/strict";
import { GiphyService, MAX_GIPHY_LIMIT, DEFAULT_GIPHY_LIMIT } from "./giphy";

test("isConfigured() is false when no api key is provided", () => {
  const service = new GiphyService(undefined, async () => undefined);
  assert.equal(service.isConfigured(), false);
});

test("isConfigured() is true when an api key is provided", () => {
  const service = new GiphyService("test-key", async () => undefined);
  assert.equal(service.isConfigured(), true);
});

test("search() returns undefined when not configured", async () => {
  const service = new GiphyService(undefined, async () => [{ id: "1", url: "u", previewUrl: "p", title: "t" }]);
  const result = await service.search("cats", "gifs");
  assert.equal(result, undefined);
});

test("search() returns undefined when the injected fetcher fails", async () => {
  const service = new GiphyService("test-key", async () => undefined);
  const result = await service.search("cats", "gifs");
  assert.equal(result, undefined);
});

test("search() returns the fetcher's results when configured and successful", async () => {
  const service = new GiphyService("test-key", async () => [
    { id: "1", url: "https://example.com/1.gif", previewUrl: "https://example.com/1-small.gif", title: "cat" },
  ]);
  const result = await service.search("cats", "gifs");
  assert.deepEqual(result, [
    { id: "1", url: "https://example.com/1.gif", previewUrl: "https://example.com/1-small.gif", title: "cat" },
  ]);
});

test("search() passes the query, type, api key, and default limit through to the fetcher", async () => {
  let received: unknown;
  const service = new GiphyService("test-key", async (query, type, apiKey, limit) => {
    received = { query, type, apiKey, limit };
    return [];
  });
  await service.search("cats", "stickers");
  assert.deepEqual(received, { query: "cats", type: "stickers", apiKey: "test-key", limit: DEFAULT_GIPHY_LIMIT });
});

test("search() clamps a requested limit to MAX_GIPHY_LIMIT", async () => {
  let receivedLimit: number | undefined;
  const service = new GiphyService("test-key", async (_q, _t, _k, limit) => {
    receivedLimit = limit;
    return [];
  });
  await service.search("cats", "gifs", 1000);
  assert.equal(receivedLimit, MAX_GIPHY_LIMIT);
});

test("search() clamps a limit below 1 up to 1", async () => {
  let receivedLimit: number | undefined;
  const service = new GiphyService("test-key", async (_q, _t, _k, limit) => {
    receivedLimit = limit;
    return [];
  });
  await service.search("cats", "gifs", 0);
  assert.equal(receivedLimit, 1);
});
