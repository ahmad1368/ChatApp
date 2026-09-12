import { test } from "node:test";
import assert from "node:assert/strict";
import { MeasurementUnitsStore } from "./measurementUnits";

test("get() defaults to metric for a fresh author", () => {
  const store = new MeasurementUnitsStore();
  assert.equal(store.get("alice"), "metric");
});

test("update() rejects a missing author", () => {
  const store = new MeasurementUnitsStore();
  const result = store.update("", "imperial");
  assert.equal(result.success, false);
});

test("update() rejects an invalid system", () => {
  const store = new MeasurementUnitsStore();
  const result = store.update("alice", "furlongs");
  assert.equal(result.success, false);
});

test("update() switches to imperial and persists it", () => {
  const store = new MeasurementUnitsStore();
  const result = store.update("alice", "imperial");
  assert.deepEqual(result, { success: true, system: "imperial" });
  assert.equal(store.get("alice"), "imperial");
});

test("preferences are independent per author", () => {
  const store = new MeasurementUnitsStore();
  store.update("alice", "imperial");
  assert.equal(store.get("bob"), "metric");
});
