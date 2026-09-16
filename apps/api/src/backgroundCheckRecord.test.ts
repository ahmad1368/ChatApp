import { test } from "node:test";
import assert from "node:assert/strict";
import { BackgroundCheckStore } from "./backgroundCheckRecord";

test("get() defaults to notRequested for an untracked author", () => {
  const store = new BackgroundCheckStore();
  assert.deepEqual(store.get("alice"), { status: "notRequested", candidateId: null, invitationUrl: null, requestedAt: null });
});

test("recordInvitation() stores the invited status with candidate/invitation details", () => {
  const store = new BackgroundCheckStore();
  const result = store.recordInvitation("alice", "c1", "https://checkr.example/invite/c1");
  assert.equal(result.status, "invited");
  assert.equal(result.candidateId, "c1");
  assert.equal(result.invitationUrl, "https://checkr.example/invite/c1");
  assert.ok(result.requestedAt);
});

test("updateStatus() changes only the status, keeping candidate/invitation details", () => {
  const store = new BackgroundCheckStore();
  store.recordInvitation("alice", "c1", "https://checkr.example/invite/c1");
  const result = store.updateStatus("alice", "clear");
  assert.equal(result.status, "clear");
  assert.equal(result.candidateId, "c1");
});

test("hasCleanRecordBadge() is false before a check is requested", () => {
  const store = new BackgroundCheckStore();
  assert.equal(store.hasCleanRecordBadge("alice"), false);
});

test("hasCleanRecordBadge() is false while invited/pending", () => {
  const store = new BackgroundCheckStore();
  store.recordInvitation("alice", "c1", "https://checkr.example/invite/c1");
  assert.equal(store.hasCleanRecordBadge("alice"), false);
  store.updateStatus("alice", "pending");
  assert.equal(store.hasCleanRecordBadge("alice"), false);
});

test("hasCleanRecordBadge() is true once clear, false if consider", () => {
  const store = new BackgroundCheckStore();
  store.recordInvitation("alice", "c1", "https://checkr.example/invite/c1");
  store.updateStatus("alice", "clear");
  assert.equal(store.hasCleanRecordBadge("alice"), true);

  store.updateStatus("bob", "consider");
  assert.equal(store.hasCleanRecordBadge("bob"), false);
});

test("each author's record is independent", () => {
  const store = new BackgroundCheckStore();
  store.recordInvitation("alice", "c1", "https://checkr.example/invite/c1");
  assert.equal(store.get("bob").status, "notRequested");
});
