import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OnboardingStore } from "./onboarding";

describe("OnboardingStore", () => {
  it("starts a new user at the first step with an empty profile", () => {
    const store = new OnboardingStore();
    assert.deepEqual(store.getState("user-1"), { currentStep: "displayName", profile: {} });
  });

  it("advances through the full flow to completion", () => {
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
    assert.equal(step3.state.currentStep, "complete");
    assert.deepEqual(step3.state.profile, {
      displayName: "Alice",
      avatarUrl: "https://example.com/a.png",
      bio: "Hello there",
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

  it("rejects an empty display name", () => {
    const store = new OnboardingStore();
    const result = store.submitStep("user-1", "displayName", "   ");
    assert.equal(result.success, false);
  });

  it("rejects submitting a step out of order", () => {
    const store = new OnboardingStore();
    // Still on "displayName" — trying to submit "bio" should fail rather
    // than silently accept out-of-order data.
    const result = store.submitStep("user-1", "bio", "Hello");
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
