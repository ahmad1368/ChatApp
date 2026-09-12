import test from "node:test";
import assert from "node:assert/strict";
import { DiscountCodeStore } from "./discountCodes";

test("list() is empty before any code is created", () => {
  const store = new DiscountCodeStore();
  assert.deepEqual(store.list(), []);
});

test("create() rejects a missing code", () => {
  const store = new DiscountCodeStore();
  const result = store.create("", "percent", 20, undefined, undefined);
  assert.equal(result.success, false);
});

test("create() rejects a duplicate code (case-insensitively)", () => {
  const store = new DiscountCodeStore();
  store.create("SAVE20", "percent", 20, undefined, undefined);
  const result = store.create("save20", "percent", 10, undefined, undefined);
  assert.equal(result.success, false);
});

test("create() rejects an invalid type", () => {
  const store = new DiscountCodeStore();
  const result = store.create("SAVE20", "coupon", 20, undefined, undefined);
  assert.equal(result.success, false);
});

test("create() rejects a non-positive amount", () => {
  const store = new DiscountCodeStore();
  assert.equal(store.create("SAVE0", "percent", 0, undefined, undefined).success, false);
  assert.equal(store.create("SAVENEG", "percent", -5, undefined, undefined).success, false);
});

test("create() rejects a percent amount over 100", () => {
  const store = new DiscountCodeStore();
  const result = store.create("SAVE200", "percent", 200, undefined, undefined);
  assert.equal(result.success, false);
});

test("create() rejects an invalid expiresAt", () => {
  const store = new DiscountCodeStore();
  const result = store.create("SAVE20", "percent", 20, "not-a-date", undefined);
  assert.equal(result.success, false);
});

test("create() rejects a non-positive maxRedemptions", () => {
  const store = new DiscountCodeStore();
  const result = store.create("SAVE20", "percent", 20, undefined, 0);
  assert.equal(result.success, false);
});

test("create() succeeds and normalizes the code to uppercase", () => {
  const store = new DiscountCodeStore();
  const result = store.create("save20", "percent", 20, undefined, undefined);
  assert.equal(result.success, true);
  assert.equal(result.success && result.code.code, "SAVE20");
  assert.equal(result.success && result.code.redemptionCount, 0);
  assert.equal(result.success && result.code.active, true);
});

test("validate() rejects a code that doesn't exist", () => {
  const store = new DiscountCodeStore();
  const result = store.validate("NOPE");
  assert.equal(result.valid, false);
});

test("validate() accepts a fresh code without consuming a redemption", () => {
  const store = new DiscountCodeStore();
  store.create("SAVE20", "percent", 20, undefined, undefined);
  const result = store.validate("save20");
  assert.equal(result.valid, true);
  assert.equal(store.list()[0].redemptionCount, 0);
});

test("redeem() increments redemptionCount on success", () => {
  const store = new DiscountCodeStore();
  store.create("SAVE20", "percent", 20, undefined, undefined);
  const result = store.redeem("SAVE20");
  assert.equal(result.valid, true);
  assert.equal(store.list()[0].redemptionCount, 1);
});

test("redeem() fails once maxRedemptions is reached", () => {
  const store = new DiscountCodeStore();
  store.create("ONEUSE", "fixed", 500, undefined, 1);
  const first = store.redeem("ONEUSE");
  assert.equal(first.valid, true);
  const second = store.redeem("ONEUSE");
  assert.equal(second.valid, false);
});

test("redeem() fails once expired", () => {
  const store = new DiscountCodeStore();
  store.create("EXPIRED", "percent", 10, new Date(Date.now() - 1000).toISOString(), undefined);
  const result = store.redeem("EXPIRED");
  assert.equal(result.valid, false);
});

test("deactivate() prevents further redemption and returns false when nothing to deactivate", () => {
  const store = new DiscountCodeStore();
  store.create("SAVE20", "percent", 20, undefined, undefined);
  assert.equal(store.deactivate("save20"), true);
  assert.equal(store.redeem("SAVE20").valid, false);
  assert.equal(store.deactivate("SAVE20"), false);
});

test("list() returns every code, newest first", () => {
  const store = new DiscountCodeStore();
  store.create("FIRST", "percent", 10, undefined, undefined);
  store.create("SECOND", "percent", 10, undefined, undefined);
  assert.deepEqual(
    store.list().map((c) => c.code),
    ["SECOND", "FIRST"]
  );
});
