import { test } from "node:test";
import assert from "node:assert/strict";
import { PhotoReviewStore } from "./photoReview";

const noReports = () => 0;

test("get() is undefined before a photo is enqueued", () => {
  const store = new PhotoReviewStore();
  assert.equal(store.get("photo-1"), undefined);
});

test("enqueue() adds a pending entry", () => {
  const store = new PhotoReviewStore();
  store.enqueue("photo-1", "alice");
  const entry = store.get("photo-1");
  assert.equal(entry?.status, "pending");
  assert.equal(entry?.author, "alice");
});

test("enqueue() is idempotent for an already-queued photo", () => {
  const store = new PhotoReviewStore();
  store.enqueue("photo-1", "alice");
  store.decide("photo-1", "admin", "approved", undefined);
  store.enqueue("photo-1", "alice"); // should not reset the decision
  assert.equal(store.get("photo-1")?.status, "approved");
});

test("getPendingQueue() only returns pending entries", () => {
  const store = new PhotoReviewStore();
  store.enqueue("photo-1", "alice");
  store.enqueue("photo-2", "bob");
  store.decide("photo-1", "admin", "approved", undefined);
  const queue = store.getPendingQueue(noReports);
  assert.deepEqual(
    queue.map((e) => e.photoId),
    ["photo-2"]
  );
});

test("getPendingQueue() sorts by report count, highest first", () => {
  const store = new PhotoReviewStore();
  store.enqueue("photo-1", "alice");
  store.enqueue("photo-2", "bob");
  store.enqueue("photo-3", "carol");
  const reportCounts: Record<string, number> = { alice: 1, bob: 5, carol: 2 };
  const queue = store.getPendingQueue((author) => reportCounts[author] ?? 0);
  assert.deepEqual(
    queue.map((e) => e.author),
    ["bob", "carol", "alice"]
  );
});

test("decide() rejects a missing photoId", () => {
  const store = new PhotoReviewStore();
  const result = store.decide("", "admin", "approved", undefined);
  assert.deepEqual(result, { success: false, error: "photoId is required" });
});

test("decide() rejects a missing reviewer", () => {
  const store = new PhotoReviewStore();
  store.enqueue("photo-1", "alice");
  const result = store.decide("photo-1", "", "approved", undefined);
  assert.deepEqual(result, { success: false, error: "reviewer is required" });
});

test("decide() rejects an invalid status", () => {
  const store = new PhotoReviewStore();
  store.enqueue("photo-1", "alice");
  const result = store.decide("photo-1", "admin", "maybe", undefined);
  assert.deepEqual(result, { success: false, error: "status must be 'approved' or 'rejected'" });
});

test("decide() 404s for a photo never enqueued", () => {
  const store = new PhotoReviewStore();
  const result = store.decide("nope", "admin", "approved", undefined);
  assert.deepEqual(result, { success: false, error: "Photo not found in the review queue" });
});

test("decide() records the reviewer, timestamp, and optional reason", () => {
  const store = new PhotoReviewStore();
  store.enqueue("photo-1", "alice");
  const result = store.decide("photo-1", "admin", "rejected", "Nudity");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.entry.status, "rejected");
    assert.equal(result.entry.reviewedBy, "admin");
    assert.equal(result.entry.reason, "Nudity");
    assert.ok(result.entry.reviewedAt);
  }
});

test("decide() with no reason leaves reason null", () => {
  const store = new PhotoReviewStore();
  store.enqueue("photo-1", "alice");
  const result = store.decide("photo-1", "admin", "approved", undefined);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.entry.reason, null);
});
