import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMusicMatch } from "./musicMatch";

test("computeMusicMatch() finds no shared tracks between disjoint lists", () => {
  const result = computeMusicMatch(["Song A", "Song B"], ["Song C", "Song D"]);
  assert.deepEqual(result.sharedTracks, []);
  assert.equal(result.compatibility, 0);
});

test("computeMusicMatch() lists the tracks both authors have in common", () => {
  const result = computeMusicMatch(["Song A", "Song B", "Song C"], ["Song B", "Song C", "Song D"]);
  assert.deepEqual(result.sharedTracks, ["Song B", "Song C"]);
});

test("computeMusicMatch() is 100% compatible when both lists are identical", () => {
  const result = computeMusicMatch(["Song A", "Song B"], ["Song A", "Song B"]);
  assert.deepEqual(result.sharedTracks, ["Song A", "Song B"]);
  assert.equal(result.compatibility, 100);
});

test("computeMusicMatch() is 0% with an empty track list on either side", () => {
  assert.equal(computeMusicMatch([], ["Song A"]).compatibility, 0);
  assert.equal(computeMusicMatch(["Song A"], []).compatibility, 0);
});

test("computeMusicMatch() preserves the order of tracksA for the shared list", () => {
  const result = computeMusicMatch(["Song C", "Song A", "Song B"], ["Song A", "Song C"]);
  assert.deepEqual(result.sharedTracks, ["Song C", "Song A"]);
});
