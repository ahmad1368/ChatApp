import test from "node:test";
import assert from "node:assert/strict";
import { DailySpinStore, DAILY_SPIN_SEGMENTS } from "./dailySpin";

test("getStatus() allows a spin for an author who has never spun", () => {
  const store = new DailySpinStore();
  const status = store.getStatus("alice");
  assert.equal(status.canSpin, true);
  assert.equal(status.nextSpinAt, null);
  assert.deepEqual(status.segments, DAILY_SPIN_SEGMENTS);
});

test("spin() rejects a missing author", () => {
  const store = new DailySpinStore();
  assert.equal(store.spin("").success, false);
});

test("spin() awards one of the fixed segment coin amounts", () => {
  const store = new DailySpinStore();
  const result = store.spin("alice", () => 0);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.coinsWon, DAILY_SPIN_SEGMENTS[0].coins);
});

test("spin() picks later segments as the random roll increases", () => {
  const store = new DailySpinStore();
  const result = store.spin("alice", () => 0.999999);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.coinsWon, DAILY_SPIN_SEGMENTS[DAILY_SPIN_SEGMENTS.length - 1].coins);
});

test("spin() rejects a second spin the same day", () => {
  const store = new DailySpinStore();
  store.spin("alice");
  const second = store.spin("alice");
  assert.equal(second.success, false);
});

test("getStatus() reflects canSpin becoming false after spinning, with a nextSpinAt", () => {
  const store = new DailySpinStore();
  store.spin("alice");
  const status = store.getStatus("alice");
  assert.equal(status.canSpin, false);
  assert.ok(status.nextSpinAt);
});

test("each author's spin history is independent", () => {
  const store = new DailySpinStore();
  store.spin("alice");
  assert.equal(store.getStatus("bob").canSpin, true);
});
