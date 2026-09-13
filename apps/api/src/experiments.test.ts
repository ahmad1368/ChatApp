import test from "node:test";
import assert from "node:assert/strict";
import { ExperimentStore } from "./experiments";

test("create() rejects a missing name or invalid variants", () => {
  const store = new ExperimentStore();
  assert.equal(store.create("", ["a", "b"]).success, false);
  assert.equal(store.create("Ranking test", ["only-one"]).success, false);
  assert.equal(store.create("Ranking test", ["a", "b", "c", "d", "e", "f"]).success, false);
  assert.equal(store.create("Ranking test", ["a", "a"]).success, false);
  assert.equal(store.create("Ranking test", "not-an-array").success, false);
});

test("create() succeeds and starts active", () => {
  const store = new ExperimentStore();
  const result = store.create("Ranking test", ["control", "treatment"]);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.experiment.active, true);
  assert.deepEqual(result.experiment.variants, ["control", "treatment"]);
});

test("assignVariant() is deterministic for the same author and experiment", () => {
  const store = new ExperimentStore();
  const created = store.create("Ranking test", ["control", "treatment"]);
  assert.equal(created.success, true);
  if (!created.success) return;

  const first = store.assignVariant(created.experiment.id, "alice");
  const second = store.assignVariant(created.experiment.id, "alice");
  assert.equal(first.success, true);
  if (!first.success) return;
  assert.equal(second.success && second.variant, first.variant);
});

test("assignVariant() rejects an unknown experiment, missing author, or inactive experiment", () => {
  const store = new ExperimentStore();
  assert.equal(store.assignVariant("does-not-exist", "alice").success, false);

  const created = store.create("Ranking test", ["control", "treatment"]);
  assert.equal(created.success, true);
  if (!created.success) return;
  assert.equal(store.assignVariant(created.experiment.id, "").success, false);

  store.setActive(created.experiment.id, false);
  assert.equal(store.assignVariant(created.experiment.id, "alice").success, false);
});

test("setActive() returns false for an unknown experiment", () => {
  const store = new ExperimentStore();
  assert.equal(store.setActive("does-not-exist", false), false);
});

test("getStats() reflects real assignment counts across variants, including zero", () => {
  const store = new ExperimentStore();
  const created = store.create("Ranking test", ["control", "treatment"]);
  assert.equal(created.success, true);
  if (!created.success) return;

  store.assignVariant(created.experiment.id, "alice");
  store.assignVariant(created.experiment.id, "bob");
  store.assignVariant(created.experiment.id, "carol");

  const stats = store.getStats(created.experiment.id);
  assert.ok(stats);
  if (!stats) return;
  assert.equal(stats.control + stats.treatment, 3);
  assert.equal(Object.keys(stats).sort().join(","), "control,treatment");
});

test("getStats() returns undefined for an unknown experiment", () => {
  const store = new ExperimentStore();
  assert.equal(store.getStats("does-not-exist"), undefined);
});

test("list() returns newest first", () => {
  const store = new ExperimentStore();
  const first = store.create("First test", ["a", "b"]);
  const second = store.create("Second test", ["a", "b"]);
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  if (!first.success || !second.success) return;
  assert.deepEqual(
    store.list().map((e) => e.id),
    [second.experiment.id, first.experiment.id]
  );
});
