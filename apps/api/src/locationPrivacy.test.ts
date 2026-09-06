import { test } from "node:test";
import assert from "node:assert/strict";
import { approximateLocation, haversineDistanceKm, isValidCoordinates, LocationStore } from "./locationPrivacy";

test("approximateLocation() never strays more than ~precisionKm from the exact point", () => {
  const exact = { lat: 37.7749, lng: -122.4194 };
  const approx = approximateLocation(exact, 5);
  const distance = haversineDistanceKm(exact, approx);
  assert.ok(distance <= 5, `expected distance <= 5km, got ${distance}`);
});

test("approximateLocation() is deterministic for the same exact point", () => {
  const exact = { lat: 51.5074, lng: -0.1278 };
  assert.deepEqual(approximateLocation(exact), approximateLocation(exact));
});

test("approximateLocation() never reveals the exact coordinates", () => {
  const exact = { lat: 40.7128, lng: -74.006 };
  const approx = approximateLocation(exact, 5);
  assert.notDeepEqual(approx, exact);
});

test("approximateLocation() stays well-behaved near the poles", () => {
  const exact = { lat: 89.9, lng: 10 };
  const approx = approximateLocation(exact, 5);
  assert.ok(Number.isFinite(approx.lat) && Number.isFinite(approx.lng));
});

test("isValidCoordinates() accepts valid lat/lng and rejects out-of-range or malformed input", () => {
  assert.equal(isValidCoordinates({ lat: 10, lng: 20 }), true);
  assert.equal(isValidCoordinates({ lat: 91, lng: 20 }), false);
  assert.equal(isValidCoordinates({ lat: 10, lng: -181 }), false);
  assert.equal(isValidCoordinates({ lat: "10", lng: 20 }), false);
  assert.equal(isValidCoordinates(null), false);
  assert.equal(isValidCoordinates(undefined), false);
});

test("LocationStore returns null for an author with no stored location", () => {
  const store = new LocationStore();
  assert.equal(store.getApproximateLocation("alice"), null);
  assert.equal(store.hasLocation("alice"), false);
});

test("LocationStore round-trips an exact location into an approximate one", () => {
  const store = new LocationStore();
  const exact = { lat: 48.8566, lng: 2.3522 };
  store.setLocation("alice", exact);

  assert.equal(store.hasLocation("alice"), true);
  const approx = store.getApproximateLocation("alice", 5);
  assert.ok(approx);
  assert.ok(haversineDistanceKm(exact, approx!) <= 5);
});
