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

  it("advances through the full flow, including dating goal, ending on the gender step", () => {
    const store = new OnboardingStore();

    const step1 = store.submitStep("user-1", "displayName", "Alice");
    assert.ok(step1.success);
    assert.equal(step1.state.currentStep, "avatar");
    assert.equal(step1.state.profile.displayName, "Alice");

    const step2 = store.submitStep("user-1", "avatar", "https://example.com/a.png");
    assert.ok(step2.success);
    assert.equal(step2.state.currentStep, "bio");

    const step3 = store.submitStep("user-1", "bio", "Hello there");
    assert.ok(step3.success);
    assert.equal(step3.state.currentStep, "datingGoal");

    const step4 = store.submitStep("user-1", "datingGoal", "marriage");
    assert.ok(step4.success);
    assert.equal(step4.state.currentStep, "gender");
    assert.deepEqual(step4.state.profile, {
      displayName: "Alice",
      avatarUrl: "https://example.com/a.png",
      bio: "Hello there",
      datingGoal: "marriage",
    });
  });

  it("allows skipping the optional avatar step with an empty value", () => {
    const store = new OnboardingStore();
    store.submitStep("user-1", "displayName", "Alice");
    const result = store.submitStep("user-1", "avatar", "");
    assert.ok(result.success);
    assert.equal(result.state.profile.avatarUrl, undefined);
    assert.equal(result.state.currentStep, "bio");
  });

  it("rejects an invalid dating goal", () => {
    const store = new OnboardingStore();
    store.submitStep("user-1", "displayName", "Alice");
    store.submitStep("user-1", "avatar", "");
    store.submitStep("user-1", "bio", "");
    const result = store.submitStep("user-1", "datingGoal", "world-domination");
    assert.equal(result.success, false);
  });

  it("accepts each valid dating goal option", () => {
    for (const goal of ["marriage", "friendship", "casual"] as const) {
      const store = new OnboardingStore();
      store.submitStep("user-1", "displayName", "Alice");
      store.submitStep("user-1", "avatar", "");
      store.submitStep("user-1", "bio", "");
      const result = store.submitStep("user-1", "datingGoal", goal);
      assert.ok(result.success);
      assert.equal(result.state.profile.datingGoal, goal);
    }
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

  it("rejects an empty display name", () => {
    const store = new OnboardingStore();
    const result = store.submitStep("user-1", "displayName", "   ");
    assert.equal(result.success, false);
  });

  it("rejects submitting a step out of order", () => {
    const store = new OnboardingStore();
    // Still on "displayName" — trying to submit "datingGoal" should fail
    // rather than silently accept out-of-order data.
    const result = store.submitStep("user-1", "datingGoal", "marriage");
    assert.equal(result.success, false);
  });

  it("resumes exactly where a user left off", () => {
    const store = new OnboardingStore();
    store.submitStep("user-1", "displayName", "Alice");
    // Simulate the user closing the app and coming back later.
    const resumed = store.getState("user-1");
    assert.equal(resumed.currentStep, "avatar");
    assert.equal(resumed.profile.displayName, "Alice");
  });
});
