import { test } from "node:test";
import assert from "node:assert/strict";
import { DateReviewStore } from "./dateReviews";

test("getMyReview() returns undefined before any submission", () => {
  const store = new DateReviewStore();
  assert.equal(store.getMyReview("alice", "bob"), undefined);
});

test("submit() rejects missing reviewer or reviewedAuthor", () => {
  const store = new DateReviewStore();
  assert.equal(store.submit("", "bob", true, 5, "").success, false);
  assert.equal(store.submit("alice", "", true, 5, "").success, false);
});

test("submit() rejects reviewing yourself", () => {
  const store = new DateReviewStore();
  const result = store.submit("alice", "alice", true, 5, "");
  assert.equal(result.success, false);
});

test("submit() rejects a non-boolean didMeet", () => {
  const store = new DateReviewStore();
  const result = store.submit("alice", "bob", "yes", 5, "");
  assert.equal(result.success, false);
});

test("submit() requires a valid 1-5 rating when didMeet is true", () => {
  const store = new DateReviewStore();
  assert.equal(store.submit("alice", "bob", true, 0, "").success, false);
  assert.equal(store.submit("alice", "bob", true, 6, "").success, false);
  assert.equal(store.submit("alice", "bob", true, 3.5, "").success, false);
  assert.equal(store.submit("alice", "bob", true, null, "").success, false);
});

test("submit() forces rating to null when didMeet is false, even if a rating was passed", () => {
  const store = new DateReviewStore();
  const result = store.submit("alice", "bob", false, 5, "Never showed up");
  assert.equal(result.success, true);
  assert.equal(store.getMyReview("alice", "bob")?.rating, null);
});

test("submit() accepts a valid review and getMyReview() returns it", () => {
  const store = new DateReviewStore();
  const result = store.submit("alice", "bob", true, 4, "Had a great time");
  assert.equal(result.success, true);
  const review = store.getMyReview("alice", "bob");
  assert.equal(review?.didMeet, true);
  assert.equal(review?.rating, 4);
  assert.equal(review?.feedback, "Had a great time");
});

test("submit() truncates overly long feedback", () => {
  const store = new DateReviewStore();
  store.submit("alice", "bob", true, 5, "x".repeat(600));
  assert.equal(store.getMyReview("alice", "bob")?.feedback.length, 500);
});

test("resubmitting replaces the previous review for that direction", () => {
  const store = new DateReviewStore();
  store.submit("alice", "bob", true, 2, "Meh");
  store.submit("alice", "bob", true, 5, "Actually great on reflection");
  const review = store.getMyReview("alice", "bob");
  assert.equal(review?.rating, 5);
  assert.equal(review?.feedback, "Actually great on reflection");
});

test("a review is confidential: the reviewed author's own review of the reviewer is entirely separate", () => {
  const store = new DateReviewStore();
  store.submit("alice", "bob", true, 5, "Great!");
  assert.equal(store.getMyReview("bob", "alice"), undefined);
});

test("each pair's review is independent", () => {
  const store = new DateReviewStore();
  store.submit("alice", "bob", true, 5, "");
  assert.equal(store.getMyReview("alice", "carol"), undefined);
});
