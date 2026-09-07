import { test } from "node:test";
import assert from "node:assert/strict";
import { TopPicksStore, DAILY_TOP_PICKS_COUNT } from "./topPicks";

const ratings: Record<string, number> = { alice: 1600, bob: 1500, carol: 1700, dave: 1400 };
const getRating = (candidate: string) => ratings[candidate] ?? 1500;

test("getTopPicks() ranks candidates by desirability rating, highest first", () => {
  const store = new TopPicksStore();
  const picks = store.getTopPicks("me", ["alice", "bob", "carol", "dave"], getRating);
  assert.deepEqual(
    picks.map((p) => p.author),
    ["carol", "alice", "bob", "dave"]
  );
});

test("getTopPicks() includes the desirability rating for each pick", () => {
  const store = new TopPicksStore();
  const picks = store.getTopPicks("me", ["carol"], getRating);
  assert.deepEqual(picks, [{ author: "carol", desirabilityRating: 1700 }]);
});

test("getTopPicks() caps the result at DAILY_TOP_PICKS_COUNT", () => {
  const store = new TopPicksStore();
  const pool = Array.from({ length: 20 }, (_, i) => `candidate${i}`);
  const picks = store.getTopPicks("me", pool, () => 1500);
  assert.equal(picks.length, DAILY_TOP_PICKS_COUNT);
});

test("getTopPicks() caches the result for the same author within the same day", () => {
  const store = new TopPicksStore();
  const first = store.getTopPicks("me", ["alice", "bob"], getRating);
  // Even if the pool changes, the same day's cached picks are returned.
  const second = store.getTopPicks("me", ["carol"], getRating);
  assert.deepEqual(second, first);
});

test("getTopPicks() is independent per author", () => {
  const store = new TopPicksStore();
  store.getTopPicks("me", ["alice"], getRating);
  const otherPicks = store.getTopPicks("someone-else", ["carol"], getRating);
  assert.deepEqual(otherPicks, [{ author: "carol", desirabilityRating: 1700 }]);
});

test("getTopPicks() returns an empty list for an empty pool", () => {
  const store = new TopPicksStore();
  assert.deepEqual(store.getTopPicks("me", [], getRating), []);
});

test("getTopPicks() does not cache an empty pool, so a later non-empty pool still generates picks the same day", () => {
  const store = new TopPicksStore();
  const empty = store.getTopPicks("me", [], getRating);
  assert.deepEqual(empty, []);
  const picks = store.getTopPicks("me", ["carol"], getRating);
  assert.deepEqual(picks, [{ author: "carol", desirabilityRating: 1700 }]);
});
