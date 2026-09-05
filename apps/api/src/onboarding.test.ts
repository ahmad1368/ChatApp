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

  it("accepts an uploaded avatar URL for the avatar step", () => {
    const store = new OnboardingStore();
    store.submitStep("user-1", "displayName", "Alice");
    const result = store.submitStep("user-1", "avatar", "/api/uploads/abc-123");
    assert.ok(result.success);
    assert.equal(result.state.profile.avatarUrl, "/api/uploads/abc-123");
    assert.equal(result.state.currentStep, "bio");
  });

  it("allows skipping the avatar step", () => {
    const store = new OnboardingStore();
    store.submitStep("user-1", "displayName", "Alice");
    const result = store.submitStep("user-1", "avatar", "");
    assert.ok(result.success);
    assert.equal(result.state.profile.avatarUrl, undefined);
  });

  it("completes the full flow ending on the search radius step", () => {
    const store = new OnboardingStore();
    completeUpToSearchRadius(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "searchRadius");
  });
});
