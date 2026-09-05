import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENDER_OPTIONS } from "@chatapp/shared";
import { OnboardingStore } from "./onboarding";

function completeUpToGender(store: OnboardingStore, userId: string) {
  store.submitStep(userId, "displayName", "Alice");
  store.submitStep(userId, "avatar", "");
  store.submitStep(userId, "bio", "");
  store.submitStep(userId, "datingGoal", "marriage");
}

describe("OnboardingStore", () => {
  it("starts a new user at the first step with an empty profile", () => {
    const store = new OnboardingStore();
    assert.deepEqual(store.getState("user-1"), { currentStep: "displayName", profile: {} });
  });

  it("completes the full flow ending on the gender step", () => {
    const store = new OnboardingStore();
    completeUpToGender(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "gender");
  });

  it("accepts every non-custom gender option", () => {
    for (const option of GENDER_OPTIONS.filter((o) => o !== "custom")) {
      const store = new OnboardingStore();
      completeUpToGender(store, "user-1");
      const result = store.submitStep("user-1", "gender", { option });
      assert.ok(result.success);
      assert.equal(result.state.currentStep, "complete");
      assert.equal(result.state.profile.gender, option);
    }
  });

  it("requires custom text when 'custom' is chosen", () => {
    const store = new OnboardingStore();
    completeUpToGender(store, "user-1");
    const result = store.submitStep("user-1", "gender", { option: "custom" });
    assert.equal(result.success, false);
  });

  it("accepts a custom gender description", () => {
    const store = new OnboardingStore();
    completeUpToGender(store, "user-1");
    const result = store.submitStep("user-1", "gender", { option: "custom", customText: "Demiboy" });
    assert.ok(result.success);
    assert.equal(result.state.profile.gender, "custom");
    assert.equal(result.state.profile.genderCustomText, "Demiboy");
  });

  it("rejects an unrecognized gender option", () => {
    const store = new OnboardingStore();
    completeUpToGender(store, "user-1");
    const result = store.submitStep("user-1", "gender", { option: "not-a-real-option" });
    assert.equal(result.success, false);
  });

  it("rejects submitting the gender step out of order", () => {
    const store = new OnboardingStore();
    const result = store.submitStep("user-1", "gender", { option: "woman" });
    assert.equal(result.success, false);
  });

  it("resumes exactly where a user left off", () => {
    const store = new OnboardingStore();
    store.submitStep("user-1", "displayName", "Alice");
    const resumed = store.getState("user-1");
    assert.equal(resumed.currentStep, "avatar");
    assert.equal(resumed.profile.displayName, "Alice");
  });
});
