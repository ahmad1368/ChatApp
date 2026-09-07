import { test } from "node:test";
import assert from "node:assert/strict";
import { PeakHoursStore } from "./peakHours";

function atHour(hour: number): number {
  return Date.UTC(2026, 0, 1, hour, 0, 0);
}

test("getPeakHours() is empty before any activity is recorded", () => {
  const store = new PeakHoursStore();
  assert.deepEqual(store.getPeakHours(), []);
});

test("getStatus() reports not a peak hour before any activity", () => {
  const store = new PeakHoursStore();
  assert.deepEqual(store.getStatus(3, atHour(10)), { peakHours: [], isPeakHourNow: false });
});

test("recordActivity() increments the bucket for that hour", () => {
  const store = new PeakHoursStore();
  store.recordActivity(atHour(20));
  store.recordActivity(atHour(20));
  store.recordActivity(atHour(5));
  assert.deepEqual(store.getPeakHours(), [20, 5]);
});

test("getPeakHours() respects topN", () => {
  const store = new PeakHoursStore();
  store.recordActivity(atHour(1));
  store.recordActivity(atHour(2));
  store.recordActivity(atHour(3));
  assert.equal(store.getPeakHours(2).length, 2);
});

test("getPeakHours() breaks ties by lower hour first", () => {
  const store = new PeakHoursStore();
  store.recordActivity(atHour(10));
  store.recordActivity(atHour(5));
  assert.deepEqual(store.getPeakHours(2), [5, 10]);
});

test("getStatus() reports isPeakHourNow true when the current hour is a peak hour", () => {
  const store = new PeakHoursStore();
  store.recordActivity(atHour(20));
  assert.equal(store.getStatus(3, atHour(20)).isPeakHourNow, true);
});

test("getStatus() reports isPeakHourNow false when the current hour is not a peak hour", () => {
  const store = new PeakHoursStore();
  store.recordActivity(atHour(20));
  assert.equal(store.getStatus(3, atHour(9)).isPeakHourNow, false);
});
