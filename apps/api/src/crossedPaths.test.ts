import { test } from "node:test";
import assert from "node:assert/strict";
import { CrossedPathsStore, PING_WINDOW_MS } from "./crossedPaths";

const NEAR_A = { lat: 40.7128, lng: -74.006 }; // NYC
const NEAR_B = { lat: 40.713, lng: -74.0062 }; // ~30m from NEAR_A
const FAR = { lat: 34.0522, lng: -118.2437 }; // LA

test("haveCrossedPaths() is false with no pings for either author", () => {
  const store = new CrossedPathsStore();
  assert.equal(store.haveCrossedPaths("alice", "bob"), false);
});

test("haveCrossedPaths() is false when only one author has pings", () => {
  const store = new CrossedPathsStore();
  store.recordPing("alice", NEAR_A);
  assert.equal(store.haveCrossedPaths("alice", "bob"), false);
});

test("haveCrossedPaths() is true when pings are within the threshold", () => {
  const store = new CrossedPathsStore();
  store.recordPing("alice", NEAR_A);
  store.recordPing("bob", NEAR_B);
  assert.equal(store.haveCrossedPaths("alice", "bob"), true);
});

test("haveCrossedPaths() is false when pings are far apart", () => {
  const store = new CrossedPathsStore();
  store.recordPing("alice", NEAR_A);
  store.recordPing("bob", FAR);
  assert.equal(store.haveCrossedPaths("alice", "bob"), false);
});

test("haveCrossedPaths() respects a custom threshold", () => {
  const store = new CrossedPathsStore();
  store.recordPing("alice", NEAR_A);
  store.recordPing("bob", NEAR_B);
  assert.equal(store.haveCrossedPaths("alice", "bob", 0.001), false);
});

test("haveCrossedPaths() ignores pings older than the window", () => {
  const store = new CrossedPathsStore();
  const now = Date.now();
  store.recordPing("alice", NEAR_A, now - PING_WINDOW_MS - 1000);
  store.recordPing("bob", NEAR_B, now);
  assert.equal(store.haveCrossedPaths("alice", "bob", 0.5, now), false);
});

test("haveCrossedPaths() includes a ping right at the edge of the window", () => {
  const store = new CrossedPathsStore();
  const now = Date.now();
  store.recordPing("alice", NEAR_A, now - PING_WINDOW_MS + 1000);
  store.recordPing("bob", NEAR_B, now);
  assert.equal(store.haveCrossedPaths("alice", "bob", 0.5, now), true);
});

test("haveCrossedPaths() is symmetric", () => {
  const store = new CrossedPathsStore();
  store.recordPing("alice", NEAR_A);
  store.recordPing("bob", NEAR_B);
  assert.equal(store.haveCrossedPaths("bob", "alice"), true);
});

test("getCrossedAuthors() filters a candidate pool to only those who crossed paths", () => {
  const store = new CrossedPathsStore();
  store.recordPing("alice", NEAR_A);
  store.recordPing("bob", NEAR_B);
  store.recordPing("carol", FAR);
  assert.deepEqual(store.getCrossedAuthors("alice", ["bob", "carol"]), ["bob"]);
});
