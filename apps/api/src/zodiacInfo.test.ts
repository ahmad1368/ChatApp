import { test } from "node:test";
import assert from "node:assert/strict";
import { ZodiacInfoStore } from "./zodiacInfo";

test("get() returns empty fields before any update", () => {
  const store = new ZodiacInfoStore();
  assert.deepEqual(store.get("alice"), { birthMonth: null, birthDay: null, zodiacSign: null, hideZodiac: false });
});

test("update() rejects a missing author", () => {
  const store = new ZodiacInfoStore();
  const result = store.update("", 5, 15, false);
  assert.equal(result.success, false);
});

test("update() rejects an out-of-range month", () => {
  const store = new ZodiacInfoStore();
  const result = store.update("alice", 13, 1, false);
  assert.equal(result.success, false);
});

test("update() rejects a day invalid for the given month", () => {
  const store = new ZodiacInfoStore();
  const result = store.update("alice", 2, 30, false);
  assert.equal(result.success, false);
});

test("update() accepts null birthMonth to clear the value", () => {
  const store = new ZodiacInfoStore();
  store.update("alice", 5, 15, false);
  const result = store.update("alice", null, null, false);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { birthMonth: null, birthDay: null, zodiacSign: null, hideZodiac: false });
});

test("update() computes the correct zodiac sign for a date in the middle of a sign's range", () => {
  const store = new ZodiacInfoStore();
  store.update("alice", 5, 15, false);
  assert.equal(store.get("alice").zodiacSign, "taurus");
});

test("update() computes the correct zodiac sign right at a cutoff boundary", () => {
  const store = new ZodiacInfoStore();
  store.update("alice", 1, 19, false);
  assert.equal(store.get("alice").zodiacSign, "capricorn");
  store.update("alice", 1, 20, false);
  assert.equal(store.get("alice").zodiacSign, "aquarius");
});

test("update() computes capricorn correctly across the year boundary (December)", () => {
  const store = new ZodiacInfoStore();
  store.update("alice", 12, 25, false);
  assert.equal(store.get("alice").zodiacSign, "capricorn");
});

test("update() accepts hideZodiac and get() returns it", () => {
  const store = new ZodiacInfoStore();
  const result = store.update("alice", 7, 4, true);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), { birthMonth: 7, birthDay: 4, zodiacSign: "cancer", hideZodiac: true });
});

test("each author's zodiac info is independent", () => {
  const store = new ZodiacInfoStore();
  store.update("alice", 5, 15, false);
  assert.deepEqual(store.get("bob"), { birthMonth: null, birthDay: null, zodiacSign: null, hideZodiac: false });
});
