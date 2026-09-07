import { test } from "node:test";
import assert from "node:assert/strict";
import { DiscoveryFiltersStore, candidateMatchesFilters, DiscoveryFilters } from "./discoveryFilters";
import { Language } from "./languagesInfo";

test("get() returns empty filters before any update", () => {
  const store = new DiscoveryFiltersStore();
  assert.deepEqual(store.get("alice"), {
    minHeightCm: null,
    maxHeightCm: null,
    requireEducation: false,
    requiredLanguages: [],
  });
});

test("update() rejects a missing author", () => {
  const store = new DiscoveryFiltersStore();
  const result = store.update("", 160, 190, false, []);
  assert.equal(result.success, false);
});

test("update() rejects an out-of-range minHeightCm", () => {
  const store = new DiscoveryFiltersStore();
  const result = store.update("alice", 50, null, false, []);
  assert.equal(result.success, false);
});

test("update() rejects minHeightCm greater than maxHeightCm", () => {
  const store = new DiscoveryFiltersStore();
  const result = store.update("alice", 190, 160, false, []);
  assert.equal(result.success, false);
});

test("update() rejects an invalid language in requiredLanguages", () => {
  const store = new DiscoveryFiltersStore();
  const result = store.update("alice", null, null, false, ["klingon"]);
  assert.equal(result.success, false);
});

test("update() accepts valid filters, then get() returns them", () => {
  const store = new DiscoveryFiltersStore();
  const result = store.update("alice", 160, 190, true, ["english"]);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), {
    minHeightCm: 160,
    maxHeightCm: 190,
    requireEducation: true,
    requiredLanguages: ["english"],
  });
});

test("each author's filters are independent", () => {
  const store = new DiscoveryFiltersStore();
  store.update("alice", 160, 190, true, ["english"]);
  assert.deepEqual(store.get("bob"), {
    minHeightCm: null,
    maxHeightCm: null,
    requireEducation: false,
    requiredLanguages: [],
  });
});

const NO_FILTERS: DiscoveryFilters = { minHeightCm: null, maxHeightCm: null, requireEducation: false, requiredLanguages: [] };

test("candidateMatchesFilters() matches everyone when no filters are set", () => {
  assert.equal(candidateMatchesFilters(NO_FILTERS, { heightCm: null, hasEducation: false, languages: [] }), true);
});

test("candidateMatchesFilters() excludes a candidate below the minimum height", () => {
  const filters = { ...NO_FILTERS, minHeightCm: 170 };
  assert.equal(candidateMatchesFilters(filters, { heightCm: 160, hasEducation: false, languages: [] }), false);
});

test("candidateMatchesFilters() excludes a candidate with no height set when a height filter is active", () => {
  const filters = { ...NO_FILTERS, minHeightCm: 170 };
  assert.equal(candidateMatchesFilters(filters, { heightCm: null, hasEducation: false, languages: [] }), false);
});

test("candidateMatchesFilters() excludes a candidate above the maximum height", () => {
  const filters = { ...NO_FILTERS, maxHeightCm: 180 };
  assert.equal(candidateMatchesFilters(filters, { heightCm: 190, hasEducation: false, languages: [] }), false);
});

test("candidateMatchesFilters() includes a candidate within the height range", () => {
  const filters = { ...NO_FILTERS, minHeightCm: 160, maxHeightCm: 190 };
  assert.equal(candidateMatchesFilters(filters, { heightCm: 175, hasEducation: false, languages: [] }), true);
});

test("candidateMatchesFilters() excludes a candidate with no education when required", () => {
  const filters = { ...NO_FILTERS, requireEducation: true };
  assert.equal(candidateMatchesFilters(filters, { heightCm: null, hasEducation: false, languages: [] }), false);
});

test("candidateMatchesFilters() includes a candidate with education when required", () => {
  const filters = { ...NO_FILTERS, requireEducation: true };
  assert.equal(candidateMatchesFilters(filters, { heightCm: null, hasEducation: true, languages: [] }), true);
});

test("candidateMatchesFilters() excludes a candidate who speaks none of the required languages", () => {
  const filters: DiscoveryFilters = { ...NO_FILTERS, requiredLanguages: ["english", "french"] as Language[] };
  assert.equal(candidateMatchesFilters(filters, { heightCm: null, hasEducation: false, languages: ["spanish"] }), false);
});

test("candidateMatchesFilters() includes a candidate who speaks at least one required language", () => {
  const filters: DiscoveryFilters = { ...NO_FILTERS, requiredLanguages: ["english", "french"] as Language[] };
  assert.equal(
    candidateMatchesFilters(filters, { heightCm: null, hasEducation: false, languages: ["spanish", "french"] }),
    true
  );
});
