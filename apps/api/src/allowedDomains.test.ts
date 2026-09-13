import test from "node:test";
import assert from "node:assert/strict";
import { AllowedDomainStore } from "./allowedDomains";

test("isAllowed() allows any origin before any domain is added", () => {
  const store = new AllowedDomainStore();
  assert.equal(store.isAllowed("https://example.com"), true);
  assert.equal(store.isAllowed("https://evil.example"), true);
});

test("add() rejects a missing or empty origin", () => {
  const store = new AllowedDomainStore();
  assert.equal(store.add("").success, false);
  assert.equal(store.add(undefined).success, false);
});

test("add() rejects a non-http(s) protocol", () => {
  const store = new AllowedDomainStore();
  const result = store.add("ftp://example.com");
  assert.equal(result.success, false);
});

test("add() rejects an origin with a path", () => {
  const store = new AllowedDomainStore();
  const result = store.add("https://example.com/app");
  assert.equal(result.success, false);
});

test("add() rejects an over-length origin", () => {
  const store = new AllowedDomainStore();
  const result = store.add(`https://${"a".repeat(200)}.com`);
  assert.equal(result.success, false);
});

test("add() succeeds and strips a trailing slash", () => {
  const store = new AllowedDomainStore();
  const result = store.add("https://example.com/");
  assert.equal(result.success, true);
  assert.equal(result.success && result.origin, "https://example.com");
});

test("once at least one domain is added, only listed origins are allowed", () => {
  const store = new AllowedDomainStore();
  store.add("https://example.com");
  assert.equal(store.isAllowed("https://example.com"), true);
  assert.equal(store.isAllowed("https://evil.example"), false);
});

test("remove() deletes a domain and returns true; false when nothing to remove", () => {
  const store = new AllowedDomainStore();
  store.add("https://example.com");
  assert.equal(store.remove("https://example.com"), true);
  assert.equal(store.remove("https://example.com"), false);
});

test("removing every domain reverts to allowing any origin", () => {
  const store = new AllowedDomainStore();
  store.add("https://example.com");
  store.remove("https://example.com");
  assert.equal(store.isAllowed("https://anything.example"), true);
});

test("list() returns every added domain", () => {
  const store = new AllowedDomainStore();
  store.add("https://example.com");
  store.add("https://staging.example.com");
  assert.deepEqual(new Set(store.list()), new Set(["https://example.com", "https://staging.example.com"]));
});
