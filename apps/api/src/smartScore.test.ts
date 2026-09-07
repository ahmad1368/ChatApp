import { test } from "node:test";
import assert from "node:assert/strict";
import { SmartScoreStore, DEFAULT_DESIRABILITY_RATING } from "./smartScore";

test("getScore() returns the default rating and zero activity before any swipes", () => {
  const store = new SmartScoreStore();
  assert.deepEqual(store.getScore("alice"), {
    desirabilityRating: DEFAULT_DESIRABILITY_RATING,
    activityCount: 0,
  });
});

test("recordSwipeOutcome() increments the swiper's own activity count", () => {
  const store = new SmartScoreStore();
  store.recordSwipeOutcome("alice", "bob", true);
  assert.equal(store.getActivityCount("alice"), 1);
  store.recordSwipeOutcome("alice", "carol", false);
  assert.equal(store.getActivityCount("alice"), 2);
});

test("recordSwipeOutcome() does not change the swiped author's activity count", () => {
  const store = new SmartScoreStore();
  store.recordSwipeOutcome("alice", "bob", true);
  assert.equal(store.getActivityCount("bob"), 0);
});

test("recordSwipeOutcome() raises the swiped author's rating when liked by an equal-rated swiper", () => {
  const store = new SmartScoreStore();
  store.recordSwipeOutcome("alice", "bob", true);
  assert.ok(store.getRating("bob") > DEFAULT_DESIRABILITY_RATING);
});

test("recordSwipeOutcome() lowers the swiped author's rating when passed by an equal-rated swiper", () => {
  const store = new SmartScoreStore();
  store.recordSwipeOutcome("alice", "bob", false);
  assert.ok(store.getRating("bob") < DEFAULT_DESIRABILITY_RATING);
});

test("recordSwipeOutcome() does not change the swiper's own rating", () => {
  const store = new SmartScoreStore();
  store.recordSwipeOutcome("alice", "bob", true);
  assert.equal(store.getRating("alice"), DEFAULT_DESIRABILITY_RATING);
});

test("a like from a higher-rated swiper raises the swiped author's rating more than a like from a default-rated one", () => {
  const boosted = new SmartScoreStore();
  // Boost "highRater's" own rating first by having them get liked a lot.
  for (let i = 0; i < 10; i++) boosted.recordSwipeOutcome(`fan${i}`, "highRater", true);
  assert.ok(boosted.getRating("highRater") > DEFAULT_DESIRABILITY_RATING);

  boosted.recordSwipeOutcome("highRater", "target", true);
  const deltaFromHighRater = boosted.getRating("target") - DEFAULT_DESIRABILITY_RATING;

  const plain = new SmartScoreStore();
  plain.recordSwipeOutcome("averageJoe", "target", true);
  const deltaFromAverage = plain.getRating("target") - DEFAULT_DESIRABILITY_RATING;

  assert.ok(deltaFromHighRater > deltaFromAverage);
});

test("recordSwipeOutcome() ratings stay within a sane range after repeated likes", () => {
  const store = new SmartScoreStore();
  for (let i = 0; i < 50; i++) {
    store.recordSwipeOutcome(`fan${i}`, "popular", true);
  }
  assert.ok(store.getRating("popular") > DEFAULT_DESIRABILITY_RATING);
  assert.ok(Number.isFinite(store.getRating("popular")));
});

test("each author's smart score is independent", () => {
  const store = new SmartScoreStore();
  store.recordSwipeOutcome("alice", "bob", true);
  assert.deepEqual(store.getScore("carol"), {
    desirabilityRating: DEFAULT_DESIRABILITY_RATING,
    activityCount: 0,
  });
});
