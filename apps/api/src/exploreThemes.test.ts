import test from "node:test";
import assert from "node:assert/strict";
import { ExploreThemeStore } from "./exploreThemes";

test("list() and listActive() are empty before any theme is created", () => {
  const store = new ExploreThemeStore();
  assert.deepEqual(store.list(), []);
  assert.deepEqual(store.listActive(), []);
});

test("create() rejects a missing name", () => {
  const store = new ExploreThemeStore();
  const result = store.create("", ["coffee"]);
  assert.equal(result.success, false);
});

test("create() rejects an over-length name", () => {
  const store = new ExploreThemeStore();
  const result = store.create("a".repeat(41), ["coffee"]);
  assert.equal(result.success, false);
});

test("create() rejects an empty or non-array interests list", () => {
  const store = new ExploreThemeStore();
  assert.equal(store.create("Cafes", []).success, false);
  assert.equal(store.create("Cafes", "coffee").success, false);
});

test("create() rejects an interest not in the fixed catalog", () => {
  const store = new ExploreThemeStore();
  const result = store.create("Cafes", ["coffee", "underwater-basket-weaving"]);
  assert.equal(result.success, false);
});

test("create() succeeds and defaults active to true", () => {
  const store = new ExploreThemeStore();
  const result = store.create("Cafes", ["coffee", "baking"]);
  assert.equal(result.success, true);
  assert.equal(result.success && result.theme.name, "Cafes");
  assert.equal(result.success && result.theme.active, true);
  assert.ok(result.success && result.theme.id);
});

test("update() rejects an unknown themeId", () => {
  const store = new ExploreThemeStore();
  const result = store.update("nope", { name: "New name" });
  assert.equal(result.success, false);
});

test("update() applies a partial change and leaves other fields untouched", () => {
  const store = new ExploreThemeStore();
  const created = store.create("Cafes", ["coffee"]);
  const id = created.success ? created.theme.id : "";
  const result = store.update(id, { interests: ["coffee", "wine"] });
  assert.equal(result.success, true);
  assert.deepEqual(result.success ? result.theme.interests : [], ["coffee", "wine"]);
  assert.equal(result.success && result.theme.name, "Cafes");
});

test("update() can deactivate a theme", () => {
  const store = new ExploreThemeStore();
  const created = store.create("Cafes", ["coffee"]);
  const id = created.success ? created.theme.id : "";
  store.update(id, { active: false });
  assert.deepEqual(store.listActive(), []);
  assert.equal(store.list().length, 1);
});

test("update() rejects invalid interests or an over-length name", () => {
  const store = new ExploreThemeStore();
  const created = store.create("Cafes", ["coffee"]);
  const id = created.success ? created.theme.id : "";
  assert.equal(store.update(id, { interests: ["not-real"] }).success, false);
  assert.equal(store.update(id, { name: "a".repeat(41) }).success, false);
  assert.equal(store.update(id, { active: "yes" }).success, false);
});

test("listActive() excludes a deactivated theme but list() keeps it", () => {
  const store = new ExploreThemeStore();
  const cafes = store.create("Cafes", ["coffee"]);
  const sports = store.create("Sports", ["running"]);
  const cafesId = cafes.success ? cafes.theme.id : "";
  store.update(cafesId, { active: false });

  assert.deepEqual(
    store.listActive().map((t) => t.name),
    ["Sports"]
  );
  assert.equal(store.list().length, 2);
  assert.ok(sports.success);
});

test("get() returns a theme by id or undefined", () => {
  const store = new ExploreThemeStore();
  const created = store.create("Cafes", ["coffee"]);
  const id = created.success ? created.theme.id : "";
  assert.equal(store.get(id)?.name, "Cafes");
  assert.equal(store.get("nope"), undefined);
});
