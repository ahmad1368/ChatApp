import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ORIENTATION_OPTIONS } from "@chatapp/shared";
import { OnboardingStore } from "./onboarding";

function completeUpToOrientation(store: OnboardingStore, userId: string) {
  store.submitStep(userId, "displayName", "Alice");
  store.submitStep(userId, "avatar", "");
  store.submitStep(userId, "bio", "");
  store.submitStep(userId, "datingGoal", "marriage");
  store.submitStep(userId, "gender", { option: "woman" });
}

describe("OnboardingStore", () => {
  it("starts a new user at the first step with an empty profile", () => {
    const store = new OnboardingStore();
    assert.deepEqual(store.getState("user-1"), { currentStep: "displayName", profile: {} });
  });

  it("completes the full flow ending on the orientation step", () => {
    const store = new OnboardingStore();
    completeUpToOrientation(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "orientation");
  });

  it("accepts every non-custom orientation option with a valid interestedIn list", () => {
    for (const option of ORIENTATION_OPTIONS.filter((o) => o !== "custom")) {
      const store = new OnboardingStore();
      completeUpToOrientation(store, "user-1");
      const result = store.submitStep("user-1", "orientation", { option, interestedIn: ["man", "woman"] });
      assert.ok(result.success);
      assert.equal(result.state.currentStep, "complete");
      assert.equal(result.state.profile.orientation, option);
      assert.deepEqual(result.state.profile.interestedIn, ["man", "woman"]);
    }
  });

  it("requires at least one interestedIn selection", () => {
    const store = new OnboardingStore();
    completeUpToOrientation(store, "user-1");
    const result = store.submitStep("user-1", "orientation", { option: "straight", interestedIn: [] });
    assert.equal(result.success, false);
  });

  it("rejects an invalid entry in interestedIn", () => {
    const store = new OnboardingStore();
    completeUpToOrientation(store, "user-1");
    const result = store.submitStep("user-1", "orientation", { option: "straight", interestedIn: ["not-a-gender"] });
    assert.equal(result.success, false);
  });

  it("requires custom text when 'custom' orientation is chosen", () => {
    const store = new OnboardingStore();
    completeUpToOrientation(store, "user-1");
    const result = store.submitStep("user-1", "orientation", { option: "custom", interestedIn: ["woman"] });
    assert.equal(result.success, false);
  });

  it("accepts a custom orientation description", () => {
    const store = new OnboardingStore();
    completeUpToOrientation(store, "user-1");
    const result = store.submitStep("user-1", "orientation", {
      option: "custom",
      customText: "Sapiosexual",
      interestedIn: ["woman"],
    });
    assert.ok(result.success);
    assert.equal(result.state.profile.orientationCustomText, "Sapiosexual");
  });

  it("rejects submitting the orientation step out of order", () => {
    const store = new OnboardingStore();
    const result = store.submitStep("user-1", "orientation", { option: "straight", interestedIn: ["woman"] });
    assert.equal(result.success, false);
  });
});
