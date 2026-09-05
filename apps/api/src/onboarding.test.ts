import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OnboardingStore } from "./onboarding";

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
});
