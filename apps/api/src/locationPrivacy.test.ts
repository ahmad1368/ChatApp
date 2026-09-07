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

test("setPassportLocation() rejects a missing author", () => {
  const store = new LocationStore();
  const result = store.setPassportLocation("", "Tokyo", { lat: 35.6762, lng: 139.6503 });
  assert.equal(result.success, false);
});

test("setPassportLocation() rejects a missing city name", () => {
  const store = new LocationStore();
  const result = store.setPassportLocation("alice", "", { lat: 35.6762, lng: 139.6503 });
  assert.equal(result.success, false);
});

test("setPassportLocation() rejects invalid coordinates", () => {
  const store = new LocationStore();
  const result = store.setPassportLocation("alice", "Tokyo", { lat: 200, lng: 0 });
  assert.equal(result.success, false);
});

test("isPassportActive() is false before any Passport location is set", () => {
  const store = new LocationStore();
  assert.equal(store.isPassportActive("alice"), false);
  assert.equal(store.getPassportCityName("alice"), null);
});

test("setPassportLocation() activates Passport mode and getEffectiveLocation() overrides the real GPS location", () => {
  const store = new LocationStore();
  store.setLocation("alice", { lat: 48.8566, lng: 2.3522 }); // real GPS: Paris
  const result = store.setPassportLocation("alice", "Tokyo", { lat: 35.6762, lng: 139.6503 });
  assert.equal(result.success, true);

  assert.equal(store.isPassportActive("alice"), true);
  assert.equal(store.getPassportCityName("alice"), "Tokyo");

  const effective = store.getEffectiveLocation("alice", 5);
  assert.ok(effective);
  assert.ok(haversineDistanceKm({ lat: 35.6762, lng: 139.6503 }, effective!) <= 5);
});

test("getEffectiveLocation() falls back to the real GPS location when Passport mode is inactive", () => {
  const store = new LocationStore();
  const exact = { lat: 48.8566, lng: 2.3522 };
  store.setLocation("alice", exact);
  const effective = store.getEffectiveLocation("alice", 5);
  assert.ok(effective);
  assert.ok(haversineDistanceKm(exact, effective!) <= 5);
});

test("clearPassportLocation() deactivates Passport mode and reverts to the real GPS location", () => {
  const store = new LocationStore();
  const exact = { lat: 48.8566, lng: 2.3522 };
  store.setLocation("alice", exact);
  store.setPassportLocation("alice", "Tokyo", { lat: 35.6762, lng: 139.6503 });

  store.clearPassportLocation("alice");

  assert.equal(store.isPassportActive("alice"), false);
  const effective = store.getEffectiveLocation("alice", 5);
  assert.ok(effective);
  assert.ok(haversineDistanceKm(exact, effective!) <= 5);
});

test("Passport mode is independent per author", () => {
  const store = new LocationStore();
  store.setPassportLocation("alice", "Tokyo", { lat: 35.6762, lng: 139.6503 });
  assert.equal(store.isPassportActive("bob"), false);
});
