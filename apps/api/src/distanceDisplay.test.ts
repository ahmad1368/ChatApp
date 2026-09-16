import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDisplayDistanceKm } from "./distanceDisplay";

const LONDON = { lat: 51.5074, lng: -0.1278 };
const PARIS = { lat: 48.8566, lng: 2.3522 };

test("returns a rounded distance when both locations are known and not hidden", () => {
  const result = computeDisplayDistanceKm(LONDON, PARIS, false);
  assert.equal(typeof result, "number");
  assert.ok(result! > 300 && result! < 400);
});

test("returns null when the candidate hides their distance", () => {
  assert.equal(computeDisplayDistanceKm(LONDON, PARIS, true), null);
});

test("returns null when the viewer has no location on file", () => {
  assert.equal(computeDisplayDistanceKm(null, PARIS, false), null);
});

test("returns null when the candidate has no location on file", () => {
  assert.equal(computeDisplayDistanceKm(LONDON, null, false), null);
});

test("returns 0 for the same location", () => {
  assert.equal(computeDisplayDistanceKm(LONDON, LONDON, false), 0);
});
