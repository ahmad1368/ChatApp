import test from "node:test";
import assert from "node:assert/strict";
import { PricingPlanStore } from "./pricingPlans";

test("list() and listActive() are empty before any plan is created", () => {
  const store = new PricingPlanStore();
  assert.deepEqual(store.list(), []);
  assert.deepEqual(store.listActive(), []);
});

test("create() rejects a missing name", () => {
  const store = new PricingPlanStore();
  const result = store.create("", 999, "monthly", []);
  assert.equal(result.success, false);
});

test("create() rejects a negative or non-integer priceCents", () => {
  const store = new PricingPlanStore();
  assert.equal(store.create("Gold", -100, "monthly", []).success, false);
  assert.equal(store.create("Gold", 9.99, "monthly", []).success, false);
});

test("create() rejects an invalid billingPeriod", () => {
  const store = new PricingPlanStore();
  const result = store.create("Gold", 999, "weekly", []);
  assert.equal(result.success, false);
});

test("create() rejects a non-array features value and a non-string feature", () => {
  const store = new PricingPlanStore();
  assert.equal(store.create("Gold", 999, "monthly", "unlimited likes").success, false);
  assert.equal(store.create("Gold", 999, "monthly", [42]).success, false);
});

test("create() succeeds with valid fields and defaults active to true", () => {
  const store = new PricingPlanStore();
  const result = store.create("Gold", 999, "monthly", ["Unlimited likes", "See who liked you"]);
  assert.equal(result.success, true);
  assert.equal(result.success && result.plan.name, "Gold");
  assert.equal(result.success && result.plan.active, true);
  assert.ok(result.success && result.plan.id);
});

test("update() rejects an unknown planId", () => {
  const store = new PricingPlanStore();
  const result = store.update("nope", { name: "New name" });
  assert.equal(result.success, false);
});

test("update() applies a partial change and leaves other fields untouched", () => {
  const store = new PricingPlanStore();
  const created = store.create("Gold", 999, "monthly", []);
  const id = created.success ? created.plan.id : "";
  const result = store.update(id, { priceCents: 1499 });
  assert.equal(result.success, true);
  assert.equal(result.success && result.plan.priceCents, 1499);
  assert.equal(result.success && result.plan.name, "Gold");
});

test("update() can archive a plan by setting active to false", () => {
  const store = new PricingPlanStore();
  const created = store.create("Gold", 999, "monthly", []);
  const id = created.success ? created.plan.id : "";
  store.update(id, { active: false });
  assert.deepEqual(store.listActive(), []);
  assert.equal(store.list().length, 1);
});

test("listActive() excludes archived plans and sorts cheapest first", () => {
  const store = new PricingPlanStore();
  const gold = store.create("Gold", 1999, "monthly", []);
  const platinum = store.create("Platinum", 999, "monthly", []);
  store.create("Discontinued", 1, "monthly", []);
  const discontinuedId = store.list().find((p) => p.name === "Discontinued")?.id ?? "";
  store.update(discontinuedId, { active: false });

  const active = store.listActive();
  assert.deepEqual(
    active.map((p) => p.name),
    ["Platinum", "Gold"]
  );
  assert.ok(gold.success && platinum.success);
});

test("get() returns a plan by id or undefined", () => {
  const store = new PricingPlanStore();
  const created = store.create("Gold", 999, "monthly", []);
  const id = created.success ? created.plan.id : "";
  assert.equal(store.get(id)?.name, "Gold");
  assert.equal(store.get("nope"), undefined);
});
