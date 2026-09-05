import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COMMUNITY_GUIDELINES_VERSION } from "@chatapp/shared";
import { OnboardingStore } from "./onboarding";
import { VerificationStore } from "./verification";

function acceptGuidelinesAndCompleteBasics(store: OnboardingStore, userId: string) {
  store.submitStep(userId, "communityGuidelines", { accepted: true });
  store.submitStep(userId, "displayName", "Alice");
  store.submitStep(userId, "avatar", "");
  store.submitStep(userId, "bio", "");
}

describe("OnboardingStore", () => {
  it("starts a new user at the community guidelines step", () => {
    const store = new OnboardingStore(new VerificationStore());
    assert.deepEqual(store.getState("user-1"), { currentStep: "communityGuidelines", profile: {} });
  });

  it("rejects continuing without accepting the guidelines", () => {
    const store = new OnboardingStore(new VerificationStore());
    const result = store.submitStep("user-1", "communityGuidelines", { accepted: false });
    assert.equal(result.success, false);
  });

  it("rejects a missing/malformed acceptance payload", () => {
    const store = new OnboardingStore(new VerificationStore());
    const result = store.submitStep("user-1", "communityGuidelines", {});
    assert.equal(result.success, false);
  });

  it("records the accepted version and advances once accepted", () => {
    const store = new OnboardingStore(new VerificationStore());
    const result = store.submitStep("user-1", "communityGuidelines", { accepted: true });
    assert.ok(result.success);
    assert.equal(result.state.currentStep, "displayName");
    assert.equal(result.state.profile.acceptedCommunityGuidelinesVersion, COMMUNITY_GUIDELINES_VERSION);
  });

  it("rejects displayName before guidelines are accepted (out-of-order)", () => {
    const store = new OnboardingStore(new VerificationStore());
    const result = store.submitStep("user-1", "displayName", "Alice");
    assert.equal(result.success, false);
  });

  it("continues normally through the rest of the flow after accepting", () => {
    const store = new OnboardingStore(new VerificationStore());
    acceptGuidelinesAndCompleteBasics(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "datingGoal");
  });
});
