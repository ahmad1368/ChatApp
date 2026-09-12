import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildAdminMetrics, isAdminConfigured, isValidAdminKey } from "./adminMetrics";

const ORIGINAL_KEY = process.env.ADMIN_API_KEY;

beforeEach(() => {
  delete process.env.ADMIN_API_KEY;
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.ADMIN_API_KEY;
  } else {
    process.env.ADMIN_API_KEY = ORIGINAL_KEY;
  }
});

test("buildAdminMetrics() passes the given counts through unchanged", () => {
  const counts = { totalUsers: 3, totalMatches: 2, totalMessages: 10, totalReports: 1, totalBlocks: 0 };
  assert.deepEqual(buildAdminMetrics(counts), counts);
});

test("isAdminConfigured() is false when ADMIN_API_KEY isn't set", () => {
  assert.equal(isAdminConfigured(), false);
});

test("isAdminConfigured() is true once ADMIN_API_KEY is set", () => {
  process.env.ADMIN_API_KEY = "secret";
  assert.equal(isAdminConfigured(), true);
});

test("isValidAdminKey() is false when unconfigured, even with a matching guess", () => {
  assert.equal(isValidAdminKey("anything"), false);
});

test("isValidAdminKey() rejects a wrong key once configured", () => {
  process.env.ADMIN_API_KEY = "secret";
  assert.equal(isValidAdminKey("wrong"), false);
});

test("isValidAdminKey() accepts the correct key once configured", () => {
  process.env.ADMIN_API_KEY = "secret";
  assert.equal(isValidAdminKey("secret"), true);
});

test("isValidAdminKey() rejects a non-string key", () => {
  process.env.ADMIN_API_KEY = "secret";
  assert.equal(isValidAdminKey(undefined), false);
});
