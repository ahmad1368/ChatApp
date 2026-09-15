import test from "node:test";
import assert from "node:assert/strict";
import { suggestDateLocations } from "./dateLocationSuggestions";

test("returns no shared interests and no suggestions when nothing overlaps", () => {
  const result = suggestDateLocations(["hiking", "camping"], ["gaming", "reading"]);
  assert.deepEqual(result.sharedInterests, []);
  assert.deepEqual(result.suggestions, []);
});

test("computes the real intersection of both people's interests", () => {
  const result = suggestDateLocations(["hiking", "coffee", "movies"], ["coffee", "movies", "gaming"]);
  assert.deepEqual(new Set(result.sharedInterests), new Set(["coffee", "movies"]));
});

test("groups shared interests into their date-location category, most-supported first", () => {
  const result = suggestDateLocations(["coffee", "wine", "foodie", "movies"], ["coffee", "wine", "foodie", "movies"]);
  assert.equal(result.suggestions[0].category.id, "foodAndDrink");
  assert.equal(result.suggestions[0].matchingInterests.length, 3);
  assert.equal(result.suggestions[1].category.id, "entertainment");
});

test("every category has a real, non-empty suggestion string", () => {
  const result = suggestDateLocations(["hiking", "coffee", "movies", "dogs", "yoga", "gardening", "painting", "travel"], [
    "hiking",
    "coffee",
    "movies",
    "dogs",
    "yoga",
    "gardening",
    "painting",
    "travel",
  ]);
  assert.ok(result.suggestions.length > 0);
  for (const s of result.suggestions) {
    assert.ok(s.category.suggestion.length > 0);
    assert.ok(s.category.label.length > 0);
  }
});
