import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileVisitsStore, VISITOR_WINDOW_MS } from "./profileVisits";

test("getRecentVisitors() returns an empty list when nobody has visited", () => {
  const store = new ProfileVisitsStore();
  assert.deepEqual(store.getRecentVisitors("alice"), []);
});

test("recordVisit() is reflected in getRecentVisitors()", () => {
  const store = new ProfileVisitsStore();
  store.recordVisit("bob", "alice");
  const visitors = store.getRecentVisitors("alice");
  assert.equal(visitors.length, 1);
  assert.equal(visitors[0].author, "bob");
  assert.equal(typeof visitors[0].visitedAt, "string");
});

test("recordVisit() never records a self-visit", () => {
  const store = new ProfileVisitsStore();
  store.recordVisit("alice", "alice");
  assert.deepEqual(store.getRecentVisitors("alice"), []);
});

test("recordVisit() ignores an empty viewer or viewed author", () => {
  const store = new ProfileVisitsStore();
  store.recordVisit("", "alice");
  store.recordVisit("bob", "");
  assert.deepEqual(store.getRecentVisitors("alice"), []);
});

test("getRecentVisitors() excludes a visit older than the window", () => {
  const store = new ProfileVisitsStore();
  store.recordVisit("bob", "alice");
  const now = Date.now() + VISITOR_WINDOW_MS + 1000;
  assert.deepEqual(store.getRecentVisitors("alice", VISITOR_WINDOW_MS, now), []);
});

test("getRecentVisitors() includes a visit still within the window", () => {
  const store = new ProfileVisitsStore();
  store.recordVisit("bob", "alice");
  const now = Date.now() + VISITOR_WINDOW_MS - 1000;
  const visitors = store.getRecentVisitors("alice", VISITOR_WINDOW_MS, now);
  assert.equal(visitors.length, 1);
  assert.equal(visitors[0].author, "bob");
});

test("recordVisit() keeps only the most recent visit per visitor", () => {
  const store = new ProfileVisitsStore();
  store.recordVisit("bob", "alice");
  store.recordVisit("bob", "alice");
  assert.equal(store.getRecentVisitors("alice").length, 1);
});

test("getRecentVisitors() sorts by most recent visit first", () => {
  const store = new ProfileVisitsStore();
  const t0 = Date.now();
  store.recordVisit("bob", "alice", t0);
  store.recordVisit("carol", "alice", t0 + 1000);
  const visitors = store.getRecentVisitors("alice");
  assert.deepEqual(
    visitors.map((v) => v.author),
    ["carol", "bob"]
  );
});

test("visits are independent per viewed author", () => {
  const store = new ProfileVisitsStore();
  store.recordVisit("bob", "alice");
  assert.deepEqual(store.getRecentVisitors("someone-else"), []);
});
