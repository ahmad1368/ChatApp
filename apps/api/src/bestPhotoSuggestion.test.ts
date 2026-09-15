import test from "node:test";
import assert from "node:assert/strict";
import { suggestBestPhoto } from "./bestPhotoSuggestion";

test("returns no suggestion for an empty album", () => {
  const result = suggestBestPhoto([]);
  assert.deepEqual(result.ranked, []);
  assert.equal(result.suggestedPhotoId, null);
  assert.equal(result.hasEnoughFeedback, false);
});

test("returns no suggestion for a single photo even with plenty of feedback", () => {
  const result = suggestBestPhoto([{ photoId: "p1", likeCount: 10, noteCount: 5 }]);
  assert.equal(result.suggestedPhotoId, null);
  assert.equal(result.hasEnoughFeedback, true);
});

test("returns no suggestion when total feedback is below the minimum threshold", () => {
  const result = suggestBestPhoto([
    { photoId: "p1", likeCount: 1, noteCount: 0 },
    { photoId: "p2", likeCount: 0, noteCount: 0 },
  ]);
  assert.equal(result.hasEnoughFeedback, false);
  assert.equal(result.suggestedPhotoId, null);
});

test("ranks photos by score (likes + 0.5*notes) descending", () => {
  const result = suggestBestPhoto([
    { photoId: "p1", likeCount: 2, noteCount: 0 },
    { photoId: "p2", likeCount: 1, noteCount: 4 },
    { photoId: "p3", likeCount: 5, noteCount: 0 },
  ]);
  assert.deepEqual(
    result.ranked.map((r) => r.photoId),
    ["p3", "p2", "p1"]
  );
  assert.equal(result.ranked[1].score, 3);
});

test("suggests the top-ranked photo once there's enough combined feedback across a multi-photo album", () => {
  const result = suggestBestPhoto([
    { photoId: "p1", likeCount: 1, noteCount: 0 },
    { photoId: "p2", likeCount: 4, noteCount: 1 },
  ]);
  assert.equal(result.hasEnoughFeedback, true);
  assert.equal(result.suggestedPhotoId, "p2");
});
