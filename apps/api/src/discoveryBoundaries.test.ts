import test from "node:test";
import assert from "node:assert/strict";
import { DiscoveryBoundariesStore } from "./discoveryBoundaries";
import { MIN_SEARCH_RADIUS_KM, MAX_SEARCH_RADIUS_KM } from "@chatapp/shared";

test("get() returns the built-in defaults before any admin update", () => {
  const store = new DiscoveryBoundariesStore();
  assert.deepEqual(store.get(), {
    minRadiusKm: MIN_SEARCH_RADIUS_KM,
    maxRadiusKm: MAX_SEARCH_RADIUS_KM,
    defaultRadiusKm: 25,
  });
});

test("update() rejects a non-positive or non-integer minRadiusKm", () => {
  const store = new DiscoveryBoundariesStore();
  assert.equal(store.update(0, 100, 25).success, false);
  assert.equal(store.update(-5, 100, 25).success, false);
  assert.equal(store.update(1.5, 100, 25).success, false);
});

test("update() rejects a maxRadiusKm below minRadiusKm", () => {
  const store = new DiscoveryBoundariesStore();
  const result = store.update(50, 10, 25);
  assert.equal(result.success, false);
});

test("update() rejects a defaultRadiusKm outside [minRadiusKm, maxRadiusKm]", () => {
  const store = new DiscoveryBoundariesStore();
  assert.equal(store.update(10, 50, 5).success, false);
  assert.equal(store.update(10, 50, 60).success, false);
});

test("update() succeeds and get() reflects the new boundaries", () => {
  const store = new DiscoveryBoundariesStore();
  const result = store.update(5, 200, 40);
  assert.equal(result.success, true);
  assert.deepEqual(store.get(), { minRadiusKm: 5, maxRadiusKm: 200, defaultRadiusKm: 40 });
});

test("update() accepts defaultRadiusKm exactly at either boundary", () => {
  const store = new DiscoveryBoundariesStore();
  assert.equal(store.update(10, 50, 10).success, true);
  assert.equal(store.update(10, 50, 50).success, true);
});
