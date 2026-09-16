import { test } from "node:test";
import assert from "node:assert/strict";
import { computeArtistMatch } from "./artistMatch";

test("computeArtistMatch() finds no shared artists between disjoint lists", () => {
  const result = computeArtistMatch(["Artist A", "Artist B"], ["Artist C", "Artist D"]);
  assert.deepEqual(result.sharedArtists, []);
  assert.equal(result.compatibility, 0);
});

test("computeArtistMatch() lists the artists both authors have in common", () => {
  const result = computeArtistMatch(["Artist A", "Artist B", "Artist C"], ["Artist B", "Artist C", "Artist D"]);
  assert.deepEqual(result.sharedArtists, ["Artist B", "Artist C"]);
});

test("computeArtistMatch() is 100% compatible when both lists are identical", () => {
  const result = computeArtistMatch(["Artist A", "Artist B"], ["Artist A", "Artist B"]);
  assert.deepEqual(result.sharedArtists, ["Artist A", "Artist B"]);
  assert.equal(result.compatibility, 100);
});

test("computeArtistMatch() is 0% with an empty artist list on either side", () => {
  assert.equal(computeArtistMatch([], ["Artist A"]).compatibility, 0);
  assert.equal(computeArtistMatch(["Artist A"], []).compatibility, 0);
});

test("computeArtistMatch() preserves the order of artistsA for the shared list", () => {
  const result = computeArtistMatch(["Artist C", "Artist A", "Artist B"], ["Artist A", "Artist C"]);
  assert.deepEqual(result.sharedArtists, ["Artist C", "Artist A"]);
});
