import test from "node:test";
import assert from "node:assert/strict";
import { DateSpotReviewStore } from "./dateSpotReviews";

function post(store: DateSpotReviewStore, author = "alice", overrides: Partial<{ venue: string; rating: number; text: string }> = {}) {
  return store.post(author, { venue: "Blue Bottle Coffee", rating: 5, text: "Great spot for a first date.", ...overrides });
}

test("post() rejects a missing author, venue, invalid rating, or missing text", () => {
  const store = new DateSpotReviewStore();
  assert.equal(store.post("", { venue: "v", rating: 5, text: "t" }).success, false);
  assert.equal(post(store, "alice", { venue: "" }).success, false);
  assert.equal(post(store, "alice", { rating: 0 }).success, false);
  assert.equal(post(store, "alice", { rating: 6 }).success, false);
  assert.equal(post(store, "alice", { rating: 3.5 }).success, false);
  assert.equal(post(store, "alice", { text: "" }).success, false);
});

test("post() succeeds with valid data", () => {
  const store = new DateSpotReviewStore();
  const result = post(store);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.review.venue, "Blue Bottle Coffee");
  assert.equal(result.review.rating, 5);
});

test("posting again for the same venue edits the author's existing review rather than adding a second one", () => {
  const store = new DateSpotReviewStore();
  const first = post(store, "alice", { rating: 5, text: "Loved it" });
  if (!first.success) return;

  const second = post(store, "alice", { rating: 3, text: "Actually just okay" });
  assert.equal(second.success, true);
  if (!second.success) return;
  assert.equal(second.review.id, first.review.id);

  const reviews = store.listReviews("Blue Bottle Coffee");
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].rating, 3);
  assert.equal(reviews[0].text, "Actually just okay");
});

test("different authors can each leave their own review for the same venue", () => {
  const store = new DateSpotReviewStore();
  post(store, "alice", { rating: 5 });
  post(store, "bob", { rating: 3 });

  const reviews = store.listReviews("Blue Bottle Coffee");
  assert.equal(reviews.length, 2);
});

test("listReviews() returns newest first and an empty array for an unreviewed venue", () => {
  const store = new DateSpotReviewStore();
  post(store, "alice");
  assert.deepEqual(store.listReviews("Nowhere"), []);
  assert.equal(store.listReviews("Blue Bottle Coffee").length, 1);
});

test("getVenueSummary() computes the average rating and review count, and is undefined for an unreviewed venue", () => {
  const store = new DateSpotReviewStore();
  post(store, "alice", { rating: 5 });
  post(store, "bob", { rating: 3 });

  const summary = store.getVenueSummary("Blue Bottle Coffee")!;
  assert.equal(summary.reviewCount, 2);
  assert.equal(summary.averageRating, 4);

  assert.equal(store.getVenueSummary("Nowhere"), undefined);
});

test("listVenues() sorts by average rating, best first, then by review count", () => {
  const store = new DateSpotReviewStore();
  post(store, "alice", { venue: "A", rating: 3 });
  post(store, "bob", { venue: "B", rating: 5 });
  post(store, "carol", { venue: "B", rating: 5 });

  const venues = store.listVenues();
  assert.equal(venues[0].venue, "B");
  assert.equal(venues[1].venue, "A");
});
