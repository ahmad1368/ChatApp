import { test } from "node:test";
import assert from "node:assert/strict";
import { TranslationService } from "./translation";

test("isConfigured() is false when no api key is provided", () => {
  const service = new TranslationService(undefined, async () => undefined);
  assert.equal(service.isConfigured(), false);
});

test("isConfigured() is true when an api key is provided", () => {
  const service = new TranslationService("test-key", async () => undefined);
  assert.equal(service.isConfigured(), true);
});

test("translate() returns undefined when not configured", async () => {
  const service = new TranslationService(undefined, async () => "salut");
  const result = await service.translate("hello", "fr");
  assert.equal(result, undefined);
});

test("translate() returns undefined for empty text", async () => {
  const service = new TranslationService("test-key", async () => "salut");
  const result = await service.translate("   ", "fr");
  assert.equal(result, undefined);
});

test("translate() returns undefined when the injected fetcher fails", async () => {
  const service = new TranslationService("test-key", async () => undefined);
  const result = await service.translate("hello", "fr");
  assert.equal(result, undefined);
});

test("translate() returns the fetcher's result when configured and successful", async () => {
  const service = new TranslationService("test-key", async () => "salut");
  const result = await service.translate("hello", "fr");
  assert.equal(result, "salut");
});

test("translate() passes the text, target language, and api key through to the fetcher", async () => {
  let received: unknown;
  const service = new TranslationService("test-key", async (text, targetLang, apiKey) => {
    received = { text, targetLang, apiKey };
    return "translated";
  });
  await service.translate("hello", "fa");
  assert.deepEqual(received, { text: "hello", targetLang: "fa", apiKey: "test-key" });
});
