import { test } from "node:test";
import assert from "node:assert/strict";
import { LocationChangeAlertStore, IMPLAUSIBLE_SPEED_KMH } from "./locationChangeAlert";

const LONDON = { lat: 51.5074, lng: -0.1278 };
const PARIS = { lat: 48.8566, lng: 2.3522 };
const NEW_YORK = { lat: 40.7128, lng: -74.006 };

const HOUR_MS = 60 * 60 * 1000;

test("the first location update for an author is never a sudden change", () => {
  const store = new LocationChangeAlertStore();
  const result = store.recordAndCheck("alice", LONDON, 1000);
  assert.equal(result.suddenChange, false);
  assert.equal(result.distanceKm, 0);
  assert.equal(result.impliedSpeedKmh, null);
});

test("a plausible short hop over a reasonable time is not flagged", () => {
  const store = new LocationChangeAlertStore();
  store.recordAndCheck("alice", LONDON, 0);
  const result = store.recordAndCheck("alice", PARIS, 3 * HOUR_MS);
  assert.equal(result.suddenChange, false);
  assert.ok(result.impliedSpeedKmh! < IMPLAUSIBLE_SPEED_KMH);
});

test("an implausibly fast jump (London to New York in 10 minutes) is flagged", () => {
  const store = new LocationChangeAlertStore();
  store.recordAndCheck("alice", LONDON, 0);
  const result = store.recordAndCheck("alice", NEW_YORK, 10 * 60 * 1000);
  assert.equal(result.suddenChange, true);
  assert.ok(result.impliedSpeedKmh! > IMPLAUSIBLE_SPEED_KMH);
});

test("updates too close together in time are not evaluated at all", () => {
  const store = new LocationChangeAlertStore();
  store.recordAndCheck("alice", LONDON, 0);
  const result = store.recordAndCheck("alice", NEW_YORK, 1000);
  assert.equal(result.suddenChange, false);
  assert.equal(result.impliedSpeedKmh, null);
});

test("a real long-haul flight duration (7 hours) for a transatlantic hop is not flagged", () => {
  const store = new LocationChangeAlertStore();
  store.recordAndCheck("alice", LONDON, 0);
  const result = store.recordAndCheck("alice", NEW_YORK, 7 * HOUR_MS);
  assert.equal(result.suddenChange, false);
});

test("each author's location history is independent", () => {
  const store = new LocationChangeAlertStore();
  store.recordAndCheck("alice", LONDON, 0);
  const result = store.recordAndCheck("bob", NEW_YORK, 10 * 60 * 1000);
  assert.equal(result.suddenChange, false);
});
