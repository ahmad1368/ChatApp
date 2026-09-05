import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OnboardingStore } from "./onboarding";

describe("OnboardingStore", () => {
  it("starts a new user at the first step with an empty profile", () => {
    const store = new OnboardingStore();
    assert.deepEqual(store.getState("user-1"), { currentStep: "displayName", profile: {} });
  });

  it("advances through the full flow, including dating goal, to completion", () => {
    const store = new OnboardingStore();

    store.submitStep("user-1", "displayName", "Alice");
    store.submitStep("user-1", "avatar", "https://example.com/a.png");
    const step3 = store.submitStep("user-1", "bio", "Hello there");
    assert.ok(step3.success);
    assert.equal(step3.state.currentStep, "datingGoal");

    const step4 = store.submitStep("user-1", "datingGoal", "marriage");
    assert.ok(step4.success);
    assert.equal(step4.state.currentStep, "complete");
    assert.deepEqual(step4.state.profile, {
      displayName: "Alice",
      avatarUrl: "https://example.com/a.png",
      bio: "Hello there",
      datingGoal: "marriage",
    });
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

  it("rejects an empty display name", () => {
    const store = new OnboardingStore();
    const result = store.submitStep("user-1", "displayName", "   ");
    assert.equal(result.success, false);
  });

  it("rejects submitting a step out of order", () => {
    const store = new OnboardingStore();
    const result = store.submitStep("user-1", "datingGoal", "marriage");
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
