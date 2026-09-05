import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OnboardingStore } from "./onboarding";

function completeUpToSearchRadius(store: OnboardingStore, userId: string) {
  store.submitStep(userId, "displayName", "Alice");
  store.submitStep(userId, "avatar", "");
  store.submitStep(userId, "bio", "");
  store.submitStep(userId, "datingGoal", "marriage");
  store.submitStep(userId, "gender", { option: "woman" });
  store.submitStep(userId, "orientation", { option: "straight", interestedIn: ["man"] });
  store.submitStep(userId, "ageRange", { min: 25, max: 35 });
}

describe("OnboardingStore", () => {
  it("starts a new user at the first step with an empty profile", () => {
    const store = new OnboardingStore();
    assert.deepEqual(store.getState("user-1"), { currentStep: "displayName", profile: {} });
  });

  it("completes the full flow ending on the search radius step", () => {
    const store = new OnboardingStore();
    completeUpToSearchRadius(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "searchRadius");
  });

  it("accepts a radius with a location and completes onboarding", () => {
    const store = new OnboardingStore();
    completeUpToSearchRadius(store, "user-1");
    const result = store.submitStep("user-1", "searchRadius", { radiusKm: 25, location: { lat: 40.7128, lng: -74.006 } });
    assert.ok(result.success);
    assert.equal(result.state.currentStep, "complete");
    assert.equal(result.state.profile.searchRadiusKm, 25);
    assert.deepEqual(result.state.profile.location, { lat: 40.71, lng: -74.01 });
  });

  it("rounds coordinates to 2 decimal places regardless of input precision", () => {
    const store = new OnboardingStore();
    completeUpToSearchRadius(store, "user-1");
    const result = store.submitStep("user-1", "searchRadius", {
      radiusKm: 25,
      location: { lat: 40.712812345, lng: -74.0059413 },
    });
    assert.ok(result.success);
    assert.deepEqual(result.state.profile.location, { lat: 40.71, lng: -74.01 });
  });

  it("accepts a radius with no location (permission denied)", () => {
    const store = new OnboardingStore();
    completeUpToSearchRadius(store, "user-1");
    const result = store.submitStep("user-1", "searchRadius", { radiusKm: 50 });
    assert.ok(result.success);
    assert.equal(result.state.profile.searchRadiusKm, 50);
    assert.equal(result.state.profile.location, undefined);
  });

  it("rejects a radius outside the allowed bounds", () => {
    const store = new OnboardingStore();
    completeUpToSearchRadius(store, "user-1");
    const tooSmall = store.submitStep("user-1", "searchRadius", { radiusKm: 0 });
    assert.equal(tooSmall.success, false);
    const tooLarge = store.submitStep("user-1", "searchRadius", { radiusKm: 9999 });
    assert.equal(tooLarge.success, false);
  });

  it("rejects an invalid latitude/longitude", () => {
    const store = new OnboardingStore();
    completeUpToSearchRadius(store, "user-1");
    const result = store.submitStep("user-1", "searchRadius", { radiusKm: 25, location: { lat: 200, lng: 0 } });
    assert.equal(result.success, false);
  });

  it("rejects submitting the search radius step out of order", () => {
    const store = new OnboardingStore();
    const result = store.submitStep("user-1", "searchRadius", { radiusKm: 25 });
    assert.equal(result.success, false);
  });
});
