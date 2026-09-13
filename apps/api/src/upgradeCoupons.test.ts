import test from "node:test";
import assert from "node:assert/strict";
import { UpgradeCouponStore } from "./upgradeCoupons";

test("create() rejects a missing code, invalid tier, or invalid days", () => {
  const store = new UpgradeCouponStore();
  assert.equal(store.create("", "gold", 7, undefined).success, false);
  assert.equal(store.create("PROMO", "diamond", 7, undefined).success, false);
  assert.equal(store.create("PROMO", "gold", 0, undefined).success, false);
  assert.equal(store.create("PROMO", "gold", -1, undefined).success, false);
  assert.equal(store.create("PROMO", "gold", 1.5, undefined).success, false);
});

test("create() rejects a duplicate code and normalizes case", () => {
  const store = new UpgradeCouponStore();
  const first = store.create("promo", "gold", 7, undefined);
  assert.equal(first.success, true);
  if (!first.success) return;
  assert.equal(first.coupon.code, "PROMO");
  const second = store.create("PROMO", "vip", 3, undefined);
  assert.equal(second.success, false);
});

test("redeem() rejects an unknown code or missing author", () => {
  const store = new UpgradeCouponStore();
  store.create("PROMO", "gold", 7, undefined);
  assert.equal(store.redeem("does-not-exist", "alice").success, false);
  assert.equal(store.redeem("PROMO", "").success, false);
});

test("redeem() succeeds once and rejects a second redemption by the same author", () => {
  const store = new UpgradeCouponStore();
  store.create("PROMO", "gold", 7, undefined);
  const first = store.redeem("PROMO", "alice");
  assert.equal(first.success, true);
  const second = store.redeem("PROMO", "alice");
  assert.equal(second.success, false);
});

test("redeem() allows different authors to redeem the same coupon", () => {
  const store = new UpgradeCouponStore();
  store.create("PROMO", "gold", 7, undefined);
  assert.equal(store.redeem("PROMO", "alice").success, true);
  assert.equal(store.redeem("PROMO", "bob").success, true);
});

test("redeem() enforces maxRedemptions across all authors", () => {
  const store = new UpgradeCouponStore();
  store.create("PROMO", "gold", 7, 1);
  assert.equal(store.redeem("PROMO", "alice").success, true);
  assert.equal(store.redeem("PROMO", "bob").success, false);
});

test("redeem() rejects a deactivated coupon", () => {
  const store = new UpgradeCouponStore();
  store.create("PROMO", "gold", 7, undefined);
  assert.equal(store.deactivate("PROMO"), true);
  assert.equal(store.redeem("PROMO", "alice").success, false);
});

test("deactivate() returns false for an unknown or already-deactivated coupon", () => {
  const store = new UpgradeCouponStore();
  assert.equal(store.deactivate("does-not-exist"), false);
  store.create("PROMO", "gold", 7, undefined);
  store.deactivate("PROMO");
  assert.equal(store.deactivate("PROMO"), false);
});

test("list() returns newest first", () => {
  const store = new UpgradeCouponStore();
  store.create("FIRST", "gold", 7, undefined);
  store.create("SECOND", "gold", 7, undefined);
  assert.deepEqual(
    store.list().map((c) => c.code),
    ["SECOND", "FIRST"]
  );
});
