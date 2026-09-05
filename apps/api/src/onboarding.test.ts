import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OnboardingStore } from "./onboarding";

function completeUpToAgeRange(store: OnboardingStore, userId: string) {
  store.submitStep(userId, "displayName", "Alice");
  store.submitStep(userId, "avatar", "");
  store.submitStep(userId, "bio", "");
  store.submitStep(userId, "datingGoal", "marriage");
  store.submitStep(userId, "gender", { option: "woman" });
  store.submitStep(userId, "orientation", { option: "straight", interestedIn: ["man"] });
}

describe("OnboardingStore", () => {
  it("starts a new user at the first step with an empty profile", () => {
    const store = new OnboardingStore();
    assert.deepEqual(store.getState("user-1"), { currentStep: "displayName", profile: {} });
  });

  it("completes the full flow ending on the age range step", () => {
    const store = new OnboardingStore();
    completeUpToAgeRange(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "ageRange");
  });

  it("accepts a valid age range and completes onboarding", () => {
    const store = new OnboardingStore();
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 25, max: 35 });
    assert.ok(result.success);
    assert.equal(result.state.currentStep, "complete");
    assert.deepEqual(result.state.profile.preferredAgeRange, { min: 25, max: 35 });
  });

  it("rejects a min below the legal minimum", () => {
    const store = new OnboardingStore();
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 16, max: 30 });
    assert.equal(result.success, false);
  });

  it("rejects a max above the allowed maximum", () => {
    const store = new OnboardingStore();
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 20, max: 150 });
    assert.equal(result.success, false);
  });

  it("rejects min greater than max", () => {
    const store = new OnboardingStore();
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 40, max: 30 });
    assert.equal(result.success, false);
  });

  it("rejects non-integer values", () => {
    const store = new OnboardingStore();
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 25.5, max: 30 });
    assert.equal(result.success, false);
  });

  it("accepts equal min and max (a single-age preference)", () => {
    const store = new OnboardingStore();
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 30, max: 30 });
    assert.ok(result.success);
  });

  it("rejects submitting the age range step out of order", () => {
    const store = new OnboardingStore();
    const result = store.submitStep("user-1", "ageRange", { min: 25, max: 35 });
    assert.equal(result.success, false);
  });
});
