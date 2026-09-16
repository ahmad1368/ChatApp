import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMoodCompatibility, describeMood, averageMood } from "./musicMood";

test("describeMood() labels high valence/high energy as upbeat & energetic", () => {
  assert.equal(describeMood(0.8, 0.8), "upbeat & energetic");
});

test("describeMood() labels high valence/low energy as cheerful & mellow", () => {
  assert.equal(describeMood(0.8, 0.2), "cheerful & mellow");
});

test("describeMood() labels low valence/high energy as intense & moody", () => {
  assert.equal(describeMood(0.2, 0.8), "intense & moody");
});

test("describeMood() labels low valence/low energy as calm & melancholic", () => {
  assert.equal(describeMood(0.2, 0.2), "calm & melancholic");
});

test("computeMoodCompatibility() is 100% for an identical mood point", () => {
  const result = computeMoodCompatibility({ valence: 0.7, energy: 0.6 }, { valence: 0.7, energy: 0.6 });
  assert.equal(result.compatibility, 100);
  assert.equal(result.moodLabel, "upbeat & energetic");
});

test("computeMoodCompatibility() is 0% for opposite corners of the mood square", () => {
  const result = computeMoodCompatibility({ valence: 0, energy: 0 }, { valence: 1, energy: 1 });
  assert.equal(result.compatibility, 0);
});

test("computeMoodCompatibility() is unknown when either side has no mood data", () => {
  assert.deepEqual(computeMoodCompatibility({ valence: null, energy: null }, { valence: 0.5, energy: 0.5 }), {
    compatibility: 0,
    moodLabel: "unknown",
  });
});

test("averageMood() averages valence and energy across tracks", () => {
  const result = averageMood([
    { valence: 0.2, energy: 0.4 },
    { valence: 0.8, energy: 0.6 },
  ]);
  assert.deepEqual(result, { valence: 0.5, energy: 0.5 });
});

test("averageMood() returns null values for an empty track list", () => {
  assert.deepEqual(averageMood([]), { valence: null, energy: null });
});
