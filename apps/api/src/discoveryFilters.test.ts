import { test } from "node:test";
import assert from "node:assert/strict";
import { DiscoveryFiltersStore, candidateMatchesFilters, DiscoveryFilters, CandidateProfileData } from "./discoveryFilters";
import { Language } from "./languagesInfo";

const EMPTY_FILTERS_JSON = {
  minHeightCm: null,
  maxHeightCm: null,
  requireEducation: false,
  requiredLanguages: [],
  requireNonSmoking: false,
  allowedDrinking: [],
};

test("get() returns empty filters before any update", () => {
  const store = new DiscoveryFiltersStore();
  assert.deepEqual(store.get("alice"), EMPTY_FILTERS_JSON);
});

test("update() rejects a missing author", () => {
  const store = new DiscoveryFiltersStore();
  const result = store.update("", 160, 190, false, [], false, []);
  assert.equal(result.success, false);
});

test("update() rejects an out-of-range minHeightCm", () => {
  const store = new DiscoveryFiltersStore();
  const result = store.update("alice", 50, null, false, [], false, []);
  assert.equal(result.success, false);
});

test("update() rejects minHeightCm greater than maxHeightCm", () => {
  const store = new DiscoveryFiltersStore();
  const result = store.update("alice", 190, 160, false, [], false, []);
  assert.equal(result.success, false);
});

test("update() rejects an invalid language in requiredLanguages", () => {
  const store = new DiscoveryFiltersStore();
  const result = store.update("alice", null, null, false, ["klingon"], false, []);
  assert.equal(result.success, false);
});

test("update() rejects an invalid drinking option in allowedDrinking", () => {
  const store = new DiscoveryFiltersStore();
  const result = store.update("alice", null, null, false, [], false, ["a-lot"]);
  assert.equal(result.success, false);
});

test("update() accepts valid filters, then get() returns them", () => {
  const store = new DiscoveryFiltersStore();
  const result = store.update("alice", 160, 190, true, ["english"], true, ["no", "sometimes"]);
  assert.equal(result.success, true);
  assert.deepEqual(store.get("alice"), {
    minHeightCm: 160,
    maxHeightCm: 190,
    requireEducation: true,
    requiredLanguages: ["english"],
    requireNonSmoking: true,
    allowedDrinking: ["no", "sometimes"],
  });
});

test("each author's filters are independent", () => {
  const store = new DiscoveryFiltersStore();
  store.update("alice", 160, 190, true, ["english"], true, ["no"]);
  assert.deepEqual(store.get("bob"), EMPTY_FILTERS_JSON);
});

const NO_FILTERS: DiscoveryFilters = {
  minHeightCm: null,
  maxHeightCm: null,
  requireEducation: false,
  requiredLanguages: [],
  requireNonSmoking: false,
  allowedDrinking: [],
};

const NO_DATA: CandidateProfileData = { heightCm: null, hasEducation: false, languages: [], smoking: null, drinking: null };

test("candidateMatchesFilters() matches everyone when no filters are set", () => {
  assert.equal(candidateMatchesFilters(NO_FILTERS, NO_DATA), true);
});

test("candidateMatchesFilters() excludes a candidate below the minimum height", () => {
  const filters = { ...NO_FILTERS, minHeightCm: 170 };
  assert.equal(candidateMatchesFilters(filters, { ...NO_DATA, heightCm: 160 }), false);
});

test("candidateMatchesFilters() excludes a candidate with no height set when a height filter is active", () => {
  const filters = { ...NO_FILTERS, minHeightCm: 170 };
  assert.equal(candidateMatchesFilters(filters, NO_DATA), false);
});

test("candidateMatchesFilters() excludes a candidate above the maximum height", () => {
  const filters = { ...NO_FILTERS, maxHeightCm: 180 };
  assert.equal(candidateMatchesFilters(filters, { ...NO_DATA, heightCm: 190 }), false);
});

test("candidateMatchesFilters() includes a candidate within the height range", () => {
  const filters = { ...NO_FILTERS, minHeightCm: 160, maxHeightCm: 190 };
  assert.equal(candidateMatchesFilters(filters, { ...NO_DATA, heightCm: 175 }), true);
});

test("candidateMatchesFilters() excludes a candidate with no education when required", () => {
  const filters = { ...NO_FILTERS, requireEducation: true };
  assert.equal(candidateMatchesFilters(filters, NO_DATA), false);
});

test("candidateMatchesFilters() includes a candidate with education when required", () => {
  const filters = { ...NO_FILTERS, requireEducation: true };
  assert.equal(candidateMatchesFilters(filters, { ...NO_DATA, hasEducation: true }), true);
});

test("candidateMatchesFilters() excludes a candidate who speaks none of the required languages", () => {
  const filters: DiscoveryFilters = { ...NO_FILTERS, requiredLanguages: ["english", "french"] as Language[] };
  assert.equal(candidateMatchesFilters(filters, { ...NO_DATA, languages: ["spanish"] }), false);
});

test("candidateMatchesFilters() includes a candidate who speaks at least one required language", () => {
  const filters: DiscoveryFilters = { ...NO_FILTERS, requiredLanguages: ["english", "french"] as Language[] };
  assert.equal(candidateMatchesFilters(filters, { ...NO_DATA, languages: ["spanish", "french"] }), true);
});

test("candidateMatchesFilters() excludes a smoker when requireNonSmoking is set", () => {
  const filters = { ...NO_FILTERS, requireNonSmoking: true };
  assert.equal(candidateMatchesFilters(filters, { ...NO_DATA, smoking: "yes" }), false);
});

test("candidateMatchesFilters() excludes a candidate with no smoking status set when requireNonSmoking is set", () => {
  const filters = { ...NO_FILTERS, requireNonSmoking: true };
  assert.equal(candidateMatchesFilters(filters, NO_DATA), false);
});

test("candidateMatchesFilters() includes a non-smoker when requireNonSmoking is set", () => {
  const filters = { ...NO_FILTERS, requireNonSmoking: true };
  assert.equal(candidateMatchesFilters(filters, { ...NO_DATA, smoking: "no" }), true);
});

test("candidateMatchesFilters() excludes a candidate whose drinking isn't in allowedDrinking", () => {
  const filters: DiscoveryFilters = { ...NO_FILTERS, allowedDrinking: ["no"] };
  assert.equal(candidateMatchesFilters(filters, { ...NO_DATA, drinking: "yes" }), false);
});

test("candidateMatchesFilters() excludes a candidate with no drinking status set when allowedDrinking is active", () => {
  const filters: DiscoveryFilters = { ...NO_FILTERS, allowedDrinking: ["no"] };
  assert.equal(candidateMatchesFilters(filters, NO_DATA), false);
});

test("candidateMatchesFilters() includes a candidate whose drinking is in allowedDrinking", () => {
  const filters: DiscoveryFilters = { ...NO_FILTERS, allowedDrinking: ["no", "sometimes"] };
  assert.equal(candidateMatchesFilters(filters, { ...NO_DATA, drinking: "sometimes" }), true);
});
