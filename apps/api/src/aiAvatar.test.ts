import { test } from "node:test";
import assert from "node:assert/strict";
import { AiAvatarService, AiAvatarFetcher, AiAvatarStore, isAiAvatarStyle } from "./aiAvatar";

test("isAiAvatarStyle() accepts a known style", () => {
  assert.equal(isAiAvatarStyle("anime"), true);
});

test("isAiAvatarStyle() rejects an unknown value", () => {
  assert.equal(isAiAvatarStyle("realistic"), false);
  assert.equal(isAiAvatarStyle(42), false);
});

test("reports unconfigured when no API key is set", () => {
  const service = new AiAvatarService(undefined, async () => undefined);
  assert.equal(service.isConfigured(), false);
});

test("reports configured once an API key is set", () => {
  const service = new AiAvatarService("key", async () => undefined);
  assert.equal(service.isConfigured(), true);
});

test("generate() returns undefined without calling the fetcher when unconfigured", async () => {
  let called = false;
  const fetcher: AiAvatarFetcher = async () => {
    called = true;
    return Buffer.from("image");
  };
  const service = new AiAvatarService(undefined, fetcher);
  assert.equal(await service.generate(Buffer.from("photo"), "image/png", "anime"), undefined);
  assert.equal(called, false);
});

test("generate() passes the photo, mime type, style, and api key through to the fetcher", async () => {
  let received: unknown;
  const fetcher: AiAvatarFetcher = async (photoData, mimeType, style, apiKey) => {
    received = { photoData, mimeType, style, apiKey };
    return Buffer.from("generated");
  };
  const service = new AiAvatarService("secret-key", fetcher);
  const photo = Buffer.from("photo-bytes");
  const result = await service.generate(photo, "image/jpeg", "cyberpunk");
  assert.deepEqual(received, { photoData: photo, mimeType: "image/jpeg", style: "cyberpunk", apiKey: "secret-key" });
  assert.deepEqual(result, Buffer.from("generated"));
});

test("generate() propagates a fetch failure as undefined", async () => {
  const service = new AiAvatarService("key", async () => undefined);
  assert.equal(await service.generate(Buffer.from("photo"), "image/png", "anime"), undefined);
});

test("AiAvatarStore get() returns undefined for an untracked author", () => {
  const store = new AiAvatarStore();
  assert.equal(store.get("alice"), undefined);
});

test("AiAvatarStore set()/get() round-trips a record, replacing on a second set", () => {
  const store = new AiAvatarStore();
  store.set("alice", { style: "anime", mimeType: "image/png", data: Buffer.from("v1"), createdAt: "2026-01-01T00:00:00.000Z" });
  store.set("alice", { style: "cyberpunk", mimeType: "image/png", data: Buffer.from("v2"), createdAt: "2026-01-02T00:00:00.000Z" });
  assert.deepEqual(store.get("alice"), { style: "cyberpunk", mimeType: "image/png", data: Buffer.from("v2"), createdAt: "2026-01-02T00:00:00.000Z" });
});
