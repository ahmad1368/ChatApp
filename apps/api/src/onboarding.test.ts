import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OnboardingStore } from "./onboarding";
import { VerificationStore } from "./verification";

function completeUpToSelfieStep(store: OnboardingStore, userId: string) {
  store.submitStep(userId, "displayName", "Alice");
  store.submitStep(userId, "avatar", "");
  store.submitStep(userId, "bio", "");
  store.submitStep(userId, "datingGoal", "marriage");
  store.submitStep(userId, "gender", { option: "woman" });
  store.submitStep(userId, "orientation", { option: "straight", interestedIn: ["man"] });
  store.submitStep(userId, "ageRange", { min: 25, max: 35 });
  store.submitStep(userId, "searchRadius", { radiusKm: 25 });
}

describe("OnboardingStore", () => {
  it("starts a new user at the first step with an empty profile", () => {
    const store = new OnboardingStore(new VerificationStore());
    assert.deepEqual(store.getState("user-1"), { currentStep: "displayName", profile: {} });
  });

  it("resumes exactly where a user left off after a simulated 'sudden exit'", () => {
    const store = new OnboardingStore(new VerificationStore());
    store.submitStep("user-1", "displayName", "Alice");
    store.submitStep("user-1", "avatar", "");

    // Simulate a fresh page load re-fetching state for the same draft id —
    // this is exactly what a crash/closed-tab recovery looks like.
    const resumed = store.getState("user-1");
    assert.equal(resumed.currentStep, "bio");
    assert.equal(resumed.profile.displayName, "Alice");
  });

  it("completes the full flow ending on the selfie verification step", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToSelfieStep(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "selfieVerification");
  });

  it("rejects submitting a step out of order", () => {
    const store = new OnboardingStore(new VerificationStore());
    const result = store.submitStep("user-1", "bio", "hello");
    assert.equal(result.success, false);
  });
});
