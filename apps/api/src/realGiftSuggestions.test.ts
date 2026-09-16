import { test } from "node:test";
import assert from "node:assert/strict";
import { findRealGiftIdea, buildPartnerStoreUrl, buildRealGiftSuggestion } from "./realGiftSuggestions";

test("findRealGiftIdea() returns the matching catalog entry", () => {
  const idea = findRealGiftIdea("flowers");
  assert.equal(idea?.id, "flowers");
  assert.equal(idea?.name, "Flowers");
});

test("findRealGiftIdea() returns undefined for an unknown id", () => {
  assert.equal(findRealGiftIdea("spaceship"), undefined);
});

test("findRealGiftIdea() returns undefined for a non-string id", () => {
  assert.equal(findRealGiftIdea(123), undefined);
  assert.equal(findRealGiftIdea(undefined), undefined);
});

test("buildPartnerStoreUrl() builds a real Amazon search URL with the query encoded", () => {
  const url = buildPartnerStoreUrl("flower bouquet delivery");
  assert.equal(url, "https://www.amazon.com/s?k=flower%20bouquet%20delivery");
});

test("buildRealGiftSuggestion() builds the full suggestion with a real store link", () => {
  const idea = findRealGiftIdea("chocolates")!;
  const suggestion = buildRealGiftSuggestion(idea);
  assert.equal(suggestion.id, "chocolates");
  assert.equal(suggestion.name, "Chocolates");
  assert.ok(suggestion.storeUrl.startsWith("https://www.amazon.com/s?k="));
});
