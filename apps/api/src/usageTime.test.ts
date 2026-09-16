import { test } from "node:test";
import assert from "node:assert/strict";
import { UsageLimitStore, UsageTimeStore, getUsageStatus, USAGE_LIMIT_OPTIONS_MINUTES } from "./usageTime";

test("UsageLimitStore getLimit() defaults to null for an untracked author", () => {
  const store = new UsageLimitStore();
  assert.equal(store.getLimit("alice"), null);
});

test("UsageLimitStore setLimit() accepts a valid option and persists it", () => {
  const store = new UsageLimitStore();
  const result = store.setLimit("alice", 30);
  assert.deepEqual(result, { success: true, dailyLimitMinutes: 30 });
  assert.equal(store.getLimit("alice"), 30);
});

test("UsageLimitStore setLimit() rejects an unlisted value", () => {
  const store = new UsageLimitStore();
  assert.equal(store.setLimit("alice", 45).success, false);
});

test("UsageLimitStore setLimit() rejects a missing author", () => {
  const store = new UsageLimitStore();
  assert.equal(store.setLimit("", 30).success, false);
});

test("UsageLimitStore setLimit() with null clears the limit", () => {
  const store = new UsageLimitStore();
  store.setLimit("alice", 30);
  const result = store.setLimit("alice", null);
  assert.deepEqual(result, { success: true, dailyLimitMinutes: null });
  assert.equal(store.getLimit("alice"), null);
});

test("UsageTimeStore accumulates seconds recorded the same day", () => {
  const store = new UsageTimeStore();
  store.recordUsage("alice", 30);
  store.recordUsage("alice", 45);
  assert.equal(store.getUsageSecondsToday("alice"), 75);
});

test("UsageTimeStore ignores a missing author or non-positive seconds", () => {
  const store = new UsageTimeStore();
  store.recordUsage("", 30);
  store.recordUsage("alice", 0);
  store.recordUsage("alice", -5);
  assert.equal(store.getUsageSecondsToday("alice"), 0);
});

test("UsageTimeStore tracks each author independently", () => {
  const store = new UsageTimeStore();
  store.recordUsage("alice", 60);
  store.recordUsage("bob", 30);
  assert.equal(store.getUsageSecondsToday("alice"), 60);
  assert.equal(store.getUsageSecondsToday("bob"), 30);
});

test("getUsageStatus() reports limitReached once usage meets the limit", () => {
  const usageTimeStore = new UsageTimeStore();
  const usageLimitStore = new UsageLimitStore();
  usageLimitStore.setLimit("alice", USAGE_LIMIT_OPTIONS_MINUTES[0]);
  usageTimeStore.recordUsage("alice", USAGE_LIMIT_OPTIONS_MINUTES[0] * 60);
  const status = getUsageStatus(usageTimeStore, usageLimitStore, "alice");
  assert.deepEqual(status, { usageMinutesToday: USAGE_LIMIT_OPTIONS_MINUTES[0], dailyLimitMinutes: USAGE_LIMIT_OPTIONS_MINUTES[0], limitReached: true });
});

test("getUsageStatus() is never reached with no limit set", () => {
  const usageTimeStore = new UsageTimeStore();
  const usageLimitStore = new UsageLimitStore();
  usageTimeStore.recordUsage("alice", 999999);
  const status = getUsageStatus(usageTimeStore, usageLimitStore, "alice");
  assert.equal(status.limitReached, false);
  assert.equal(status.dailyLimitMinutes, null);
});

test("getUsageStatus() is false below the limit", () => {
  const usageTimeStore = new UsageTimeStore();
  const usageLimitStore = new UsageLimitStore();
  usageLimitStore.setLimit("alice", 30);
  usageTimeStore.recordUsage("alice", 60);
  assert.equal(getUsageStatus(usageTimeStore, usageLimitStore, "alice").limitReached, false);
});
