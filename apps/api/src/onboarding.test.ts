import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OnboardingStore } from "./onboarding";
import { VerificationStore } from "./verification";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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

  it("completes the full flow ending on the selfie verification step", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToSelfieStep(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "selfieVerification");
  });

  it("marks isSelfieVerified true when a selfie was already accepted", () => {
    const verificationStore = new VerificationStore();
    verificationStore.saveSelfie("user-1", "image/png", TINY_PNG_BASE64);
    const store = new OnboardingStore(verificationStore);
    completeUpToSelfieStep(store, "user-1");

    const result = store.submitStep("user-1", "selfieVerification", {});
    assert.ok(result.success);
    assert.equal(result.state.currentStep, "complete");
    assert.equal(result.state.profile.isSelfieVerified, true);
  });

  it("marks isSelfieVerified false when the user skips", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToSelfieStep(store, "user-1");

    const result = store.submitStep("user-1", "selfieVerification", { skipped: true });
    assert.ok(result.success);
    assert.equal(result.state.profile.isSelfieVerified, false);
  });

  it("rejects submitting the selfie verification step out of order", () => {
    const store = new OnboardingStore(new VerificationStore());
    const result = store.submitStep("user-1", "selfieVerification", {});
    assert.equal(result.success, false);
  });
});
