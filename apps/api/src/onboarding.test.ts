import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VerificationStore } from "./verification";
import { COMMUNITY_GUIDELINES_VERSION, GENDER_OPTIONS, ORIENTATION_OPTIONS } from "@chatapp/shared";
import { OnboardingStore } from "./onboarding";

function acceptGuidelines(store: OnboardingStore, userId: string) {
  store.submitStep(userId, "communityGuidelines", { accepted: true });
}

function completeUpToGender(store: OnboardingStore, userId: string) {
  acceptGuidelines(store, userId);
  store.submitStep(userId, "displayName", "Alice");
  store.submitStep(userId, "avatar", "");
  store.submitStep(userId, "bio", "");
  store.submitStep(userId, "datingGoal", "marriage");
}

function completeUpToOrientation(store: OnboardingStore, userId: string) {
  completeUpToGender(store, userId);
  store.submitStep(userId, "gender", { option: "woman" });
}

function completeUpToAgeRange(store: OnboardingStore, userId: string) {
  completeUpToOrientation(store, userId);
  store.submitStep(userId, "orientation", { option: "straight", interestedIn: ["man"] });
}

function completeUpToSearchRadius(store: OnboardingStore, userId: string) {
  completeUpToAgeRange(store, userId);
  store.submitStep(userId, "ageRange", { min: 25, max: 35 });
}

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function completeUpToSelfieStep(store: OnboardingStore, userId: string) {
  completeUpToSearchRadius(store, userId);
  store.submitStep(userId, "searchRadius", { radiusKm: 25 });
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

  it("advances through the full flow, including dating goal, ending on the gender step", () => {
    const store = new OnboardingStore(new VerificationStore());
    acceptGuidelines(store, "user-1");

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
    assert.equal(step4.state.profile.displayName, "Alice");
    assert.equal(step4.state.profile.avatarUrl, "https://example.com/a.png");
    assert.equal(step4.state.profile.bio, "Hello there");
    assert.equal(step4.state.profile.datingGoal, "marriage");
  });

  it("allows skipping the optional avatar step with an empty value", () => {
    const store = new OnboardingStore(new VerificationStore());
    acceptGuidelines(store, "user-1");
    store.submitStep("user-1", "displayName", "Alice");
    const result = store.submitStep("user-1", "avatar", "");
    assert.ok(result.success);
    assert.equal(result.state.profile.avatarUrl, undefined);
    assert.equal(result.state.currentStep, "bio");
  });

  it("accepts an uploaded avatar URL for the avatar step", () => {
    const store = new OnboardingStore(new VerificationStore());
    acceptGuidelines(store, "user-1");
    store.submitStep("user-1", "displayName", "Alice");
    const result = store.submitStep("user-1", "avatar", "/api/uploads/abc-123");
    assert.ok(result.success);
    assert.equal(result.state.profile.avatarUrl, "/api/uploads/abc-123");
  });

  it("rejects an invalid dating goal", () => {
    const store = new OnboardingStore(new VerificationStore());
    acceptGuidelines(store, "user-1");
    store.submitStep("user-1", "displayName", "Alice");
    store.submitStep("user-1", "avatar", "");
    store.submitStep("user-1", "bio", "");
    const result = store.submitStep("user-1", "datingGoal", "world-domination");
    assert.equal(result.success, false);
  });

  it("accepts each valid dating goal option", () => {
    for (const goal of ["marriage", "friendship", "casual"] as const) {
      const store = new OnboardingStore(new VerificationStore());
      acceptGuidelines(store, "user-1");
      store.submitStep("user-1", "displayName", "Alice");
      store.submitStep("user-1", "avatar", "");
      store.submitStep("user-1", "bio", "");
      const result = store.submitStep("user-1", "datingGoal", goal);
      assert.ok(result.success);
      assert.equal(result.state.profile.datingGoal, goal);
    }
  });

  it("completes the full flow ending on the gender step", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToGender(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "gender");
  });

  it("accepts every non-custom gender option, advancing to the orientation step", () => {
    for (const option of GENDER_OPTIONS.filter((o) => o !== "custom")) {
      const store = new OnboardingStore(new VerificationStore());
      completeUpToGender(store, "user-1");
      const result = store.submitStep("user-1", "gender", { option });
      assert.ok(result.success);
      assert.equal(result.state.currentStep, "orientation");
      assert.equal(result.state.profile.gender, option);
    }
  });

  it("requires custom text when 'custom' gender is chosen", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToGender(store, "user-1");
    const result = store.submitStep("user-1", "gender", { option: "custom" });
    assert.equal(result.success, false);
  });

  it("accepts a custom gender description", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToGender(store, "user-1");
    const result = store.submitStep("user-1", "gender", { option: "custom", customText: "Demiboy" });
    assert.ok(result.success);
    assert.equal(result.state.profile.gender, "custom");
    assert.equal(result.state.profile.genderCustomText, "Demiboy");
  });

  it("rejects an unrecognized gender option", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToGender(store, "user-1");
    const result = store.submitStep("user-1", "gender", { option: "not-a-real-option" });
    assert.equal(result.success, false);
  });

  it("rejects submitting the gender step out of order", () => {
    const store = new OnboardingStore(new VerificationStore());
    const result = store.submitStep("user-1", "gender", { option: "woman" });
    assert.equal(result.success, false);
  });

  it("completes the full flow ending on the orientation step", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToOrientation(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "orientation");
  });

  it("accepts every non-custom orientation option with a valid interestedIn list", () => {
    for (const option of ORIENTATION_OPTIONS.filter((o) => o !== "custom")) {
      const store = new OnboardingStore(new VerificationStore());
      completeUpToOrientation(store, "user-1");
      const result = store.submitStep("user-1", "orientation", { option, interestedIn: ["man", "woman"] });
      assert.ok(result.success);
      assert.equal(result.state.currentStep, "ageRange");
      assert.equal(result.state.profile.orientation, option);
      assert.deepEqual(result.state.profile.interestedIn, ["man", "woman"]);
    }
  });

  it("requires at least one interestedIn selection", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToOrientation(store, "user-1");
    const result = store.submitStep("user-1", "orientation", { option: "straight", interestedIn: [] });
    assert.equal(result.success, false);
  });

  it("rejects an invalid entry in interestedIn", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToOrientation(store, "user-1");
    const result = store.submitStep("user-1", "orientation", { option: "straight", interestedIn: ["not-a-gender"] });
    assert.equal(result.success, false);
  });

  it("requires custom text when 'custom' orientation is chosen", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToOrientation(store, "user-1");
    const result = store.submitStep("user-1", "orientation", { option: "custom", interestedIn: ["woman"] });
    assert.equal(result.success, false);
  });

  it("accepts a custom orientation description", () => {
    const store = new OnboardingStore(new VerificationStore());
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
    const store = new OnboardingStore(new VerificationStore());
    const result = store.submitStep("user-1", "orientation", { option: "straight", interestedIn: ["woman"] });
    assert.equal(result.success, false);
  });

  it("rejects an empty display name", () => {
    const store = new OnboardingStore(new VerificationStore());
    acceptGuidelines(store, "user-1");
    const result = store.submitStep("user-1", "displayName", "   ");
    assert.equal(result.success, false);
  });

  it("rejects submitting a step out of order", () => {
    const store = new OnboardingStore(new VerificationStore());
    // Still on "communityGuidelines" — trying to submit "datingGoal" should
    // fail rather than silently accept out-of-order data.
    const result = store.submitStep("user-1", "datingGoal", "marriage");
    assert.equal(result.success, false);
  });

  it("resumes exactly where a user left off", () => {
    const store = new OnboardingStore(new VerificationStore());
    acceptGuidelines(store, "user-1");
    store.submitStep("user-1", "displayName", "Alice");
    // Simulate the user closing the app and coming back later.
    const resumed = store.getState("user-1");
    assert.equal(resumed.currentStep, "avatar");
    assert.equal(resumed.profile.displayName, "Alice");
  });

  it("completes the full flow ending on the age range step", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToAgeRange(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "ageRange");
  });

  it("accepts a valid age range, advancing to the search radius step", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 25, max: 35 });
    assert.ok(result.success);
    assert.equal(result.state.currentStep, "searchRadius");
    assert.deepEqual(result.state.profile.preferredAgeRange, { min: 25, max: 35 });
  });

  it("rejects a min below the legal minimum", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 16, max: 30 });
    assert.equal(result.success, false);
  });

  it("rejects a max above the allowed maximum", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 20, max: 150 });
    assert.equal(result.success, false);
  });

  it("rejects min greater than max", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 40, max: 30 });
    assert.equal(result.success, false);
  });

  it("rejects non-integer values", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 25.5, max: 30 });
    assert.equal(result.success, false);
  });

  it("accepts equal min and max (a single-age preference)", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToAgeRange(store, "user-1");
    const result = store.submitStep("user-1", "ageRange", { min: 30, max: 30 });
    assert.ok(result.success);
  });

  it("rejects submitting the age range step out of order", () => {
    const store = new OnboardingStore(new VerificationStore());
    const result = store.submitStep("user-1", "ageRange", { min: 25, max: 35 });
    assert.equal(result.success, false);
  });

  it("completes the full flow ending on the search radius step", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToSearchRadius(store, "user-1");
    assert.equal(store.getState("user-1").currentStep, "searchRadius");
  });

  it("accepts a radius with a location, advancing to the selfie verification step", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToSearchRadius(store, "user-1");
    const result = store.submitStep("user-1", "searchRadius", { radiusKm: 25, location: { lat: 40.7128, lng: -74.006 } });
    assert.ok(result.success);
    assert.equal(result.state.currentStep, "selfieVerification");
    assert.equal(result.state.profile.searchRadiusKm, 25);
    assert.deepEqual(result.state.profile.location, { lat: 40.71, lng: -74.01 });
  });

  it("rounds coordinates to 2 decimal places regardless of input precision", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToSearchRadius(store, "user-1");
    const result = store.submitStep("user-1", "searchRadius", {
      radiusKm: 25,
      location: { lat: 40.712812345, lng: -74.0059413 },
    });
    assert.ok(result.success);
    assert.deepEqual(result.state.profile.location, { lat: 40.71, lng: -74.01 });
  });

  it("accepts a radius with no location (permission denied)", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToSearchRadius(store, "user-1");
    const result = store.submitStep("user-1", "searchRadius", { radiusKm: 50 });
    assert.ok(result.success);
    assert.equal(result.state.profile.searchRadiusKm, 50);
    assert.equal(result.state.profile.location, undefined);
  });

  it("rejects a radius outside the allowed bounds", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToSearchRadius(store, "user-1");
    const tooSmall = store.submitStep("user-1", "searchRadius", { radiusKm: 0 });
    assert.equal(tooSmall.success, false);
    const tooLarge = store.submitStep("user-1", "searchRadius", { radiusKm: 9999 });
    assert.equal(tooLarge.success, false);
  });

  it("rejects an invalid latitude/longitude", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToSearchRadius(store, "user-1");
    const result = store.submitStep("user-1", "searchRadius", { radiusKm: 25, location: { lat: 200, lng: 0 } });
    assert.equal(result.success, false);
  });

  it("rejects submitting the search radius step out of order", () => {
    const store = new OnboardingStore(new VerificationStore());
    const result = store.submitStep("user-1", "searchRadius", { radiusKm: 25 });
    assert.equal(result.success, false);
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

  it("marks isSelfieVerified false when no selfie was submitted and not explicitly skipped", () => {
    const store = new OnboardingStore(new VerificationStore());
    completeUpToSelfieStep(store, "user-1");
    const result = store.submitStep("user-1", "selfieVerification", {});
    assert.ok(result.success);
    assert.equal(result.state.profile.isSelfieVerified, false);
  });

  it("rejects submitting the selfie verification step out of order", () => {
    const store = new OnboardingStore(new VerificationStore());
    const result = store.submitStep("user-1", "selfieVerification", {});
    assert.equal(result.success, false);
  });
});
