import { test } from "node:test";
import assert from "node:assert/strict";
import { WeeklyDigestStore, buildWeeklyDigest } from "./weeklyDigest";

test("setEmail() rejects a missing author", () => {
  const store = new WeeklyDigestStore();
  const result = store.setEmail("", "alice@example.com");
  assert.equal(result.success, false);
});

test("setEmail() rejects an invalid email", () => {
  const store = new WeeklyDigestStore();
  const result = store.setEmail("alice", "not-an-email");
  assert.equal(result.success, false);
});

test("setEmail() then getEmail() returns the normalized email", () => {
  const store = new WeeklyDigestStore();
  store.setEmail("alice", "  Alice@Example.com  ");
  assert.equal(store.getEmail("alice"), "alice@example.com");
});

test("clearEmail() removes the subscription", () => {
  const store = new WeeklyDigestStore();
  store.setEmail("alice", "alice@example.com");
  store.clearEmail("alice");
  assert.equal(store.getEmail("alice"), undefined);
});

test("needsWeeklyDigest() is false without an email on file", () => {
  const store = new WeeklyDigestStore();
  assert.equal(store.needsWeeklyDigest("alice"), false);
});

test("needsWeeklyDigest() is true immediately after opting in, before any digest has been sent", () => {
  const store = new WeeklyDigestStore();
  store.setEmail("alice", "alice@example.com");
  assert.equal(store.needsWeeklyDigest("alice"), true);
});

test("needsWeeklyDigest() is false right after markSent()", () => {
  const store = new WeeklyDigestStore();
  const now = Date.now();
  store.setEmail("alice", "alice@example.com");
  store.markSent("alice", now);
  assert.equal(store.needsWeeklyDigest("alice", now + 1000), false);
});

test("needsWeeklyDigest() is true again once a full week has passed", () => {
  const store = new WeeklyDigestStore();
  const now = Date.now();
  store.setEmail("alice", "alice@example.com");
  store.markSent("alice", now);
  const oneWeekLater = now + 7 * 24 * 60 * 60 * 1000;
  assert.equal(store.needsWeeklyDigest("alice", oneWeekLater), true);
});

test("getSubscribedAuthors() lists every author with an email on file", () => {
  const store = new WeeklyDigestStore();
  store.setEmail("alice", "alice@example.com");
  store.setEmail("bob", "bob@example.com");
  assert.deepEqual(store.getSubscribedAuthors().sort(), ["alice", "bob"]);
});

test("buildWeeklyDigest() uses singular wording for exactly one like and one match", () => {
  const { body } = buildWeeklyDigest({ likeCount: 1, matchCount: 1 });
  assert.match(body, /1 person who liked you/);
  assert.match(body, /1 active match\b/);
});

test("buildWeeklyDigest() uses plural wording for zero or multiple", () => {
  const { body } = buildWeeklyDigest({ likeCount: 0, matchCount: 3 });
  assert.match(body, /0 people who liked you/);
  assert.match(body, /3 active matches/);
});
