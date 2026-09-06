import { test } from "node:test";
import assert from "node:assert/strict";
import { DiscoveryVisibilityStore } from "./discoveryVisibility";

test("getPreferences() defaults to visible-to-everyone with no city/workplace set", () => {
  const store = new DiscoveryVisibilityStore();
  assert.deepEqual(store.getPreferences("user-1"), {
    city: "",
    workplace: "",
    hideFromSameCity: false,
    hideFromSameWorkplace: false,
  });
});

test("setPreferences() rejects an overlong city or workplace", () => {
  const store = new DiscoveryVisibilityStore();
  const result = store.setPreferences("user-1", { city: "x".repeat(81) });
  assert.equal(result.success, false);
});

test("setPreferences() trims and stores the preferences", () => {
  const store = new DiscoveryVisibilityStore();
  const result = store.setPreferences("user-1", {
    city: "  Springfield  ",
    workplace: " Acme Corp ",
    hideFromSameCity: true,
    hideFromSameWorkplace: false,
  });
  assert.equal(result.success, true);
  assert.deepEqual(store.getPreferences("user-1"), {
    city: "Springfield",
    workplace: "Acme Corp",
    hideFromSameCity: true,
    hideFromSameWorkplace: false,
  });
});

test("isVisibleTo() hides a profile from a viewer in the same city when hideFromSameCity is set", () => {
  const store = new DiscoveryVisibilityStore();
  store.setPreferences("target", { city: "Springfield", hideFromSameCity: true });
  store.setPreferences("viewer", { city: "springfield" });
  assert.equal(store.isVisibleTo("target", "viewer"), false);
});

test("isVisibleTo() hides a profile from a coworker when hideFromSameWorkplace is set", () => {
  const store = new DiscoveryVisibilityStore();
  store.setPreferences("target", { workplace: "Acme Corp", hideFromSameWorkplace: true });
  store.setPreferences("viewer", { workplace: "ACME CORP" });
  assert.equal(store.isVisibleTo("target", "viewer"), false);
});

test("isVisibleTo() stays visible when the toggle is off even if the city matches", () => {
  const store = new DiscoveryVisibilityStore();
  store.setPreferences("target", { city: "Springfield", hideFromSameCity: false });
  store.setPreferences("viewer", { city: "Springfield" });
  assert.equal(store.isVisibleTo("target", "viewer"), true);
});

test("isVisibleTo() stays visible when the viewer hasn't set a matching city/workplace", () => {
  const store = new DiscoveryVisibilityStore();
  store.setPreferences("target", { city: "Springfield", hideFromSameCity: true });
  assert.equal(store.isVisibleTo("target", "viewer-with-no-city"), true);
});

test("isVisibleTo() is always true for a user viewing their own profile", () => {
  const store = new DiscoveryVisibilityStore();
  store.setPreferences("user-1", { city: "Springfield", hideFromSameCity: true });
  assert.equal(store.isVisibleTo("user-1", "user-1"), true);
});
