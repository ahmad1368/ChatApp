import {
  DATING_GOALS,
  DatingGoal,
  GENDER_OPTIONS,
  GenderOption,
  MAX_PREFERRED_AGE,
  MAX_SEARCH_RADIUS_KM,
  MIN_PREFERRED_AGE,
  MIN_SEARCH_RADIUS_KM,
  ONBOARDING_STEPS,
  ORIENTATION_OPTIONS,
  OnboardingProfile,
  OnboardingState,
  OnboardingStep,
  OrientationOption,
} from "@chatapp/shared";
import { VerificationStore } from "./verification";

const MAX_DISPLAY_NAME_LENGTH = 40;
const MAX_BIO_LENGTH = 280;
const MAX_CUSTOM_TEXT_LENGTH = 60;
const LOCATION_PRECISION_DECIMALS = 2;

export type SubmitStepResult = { success: true; state: OnboardingState } | { success: false; error: string };

function nextStep(step: OnboardingStep): OnboardingStep | "complete" {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index === ONBOARDING_STEPS.length - 1 ? "complete" : ONBOARDING_STEPS[index + 1];
}

function isDatingGoal(value: unknown): value is DatingGoal {
  return typeof value === "string" && (DATING_GOALS as readonly string[]).includes(value);
}

function isGenderOption(value: unknown): value is GenderOption {
  return typeof value === "string" && (GENDER_OPTIONS as readonly string[]).includes(value);
}

function isOrientationOption(value: unknown): value is OrientationOption {
  return typeof value === "string" && (ORIENTATION_OPTIONS as readonly string[]).includes(value);
}

function roundCoordinate(value: number): number {
  const factor = 10 ** LOCATION_PRECISION_DECIMALS;
  return Math.round(value * factor) / factor;
}

function validateStepData(
  step: OnboardingStep,
  data: unknown,
  userId: string,
  verificationStore: VerificationStore
): { value: Partial<OnboardingProfile> } | { error: string } {
  if (step === "displayName") {
    const displayName = typeof data === "string" ? data.trim() : "";
    if (!displayName) return { error: "displayName is required" };
    if (displayName.length > MAX_DISPLAY_NAME_LENGTH) return { error: `displayName must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer` };
    return { value: { displayName } };
  }
  if (step === "avatar") {
    const avatarUrl = typeof data === "string" ? data.trim() : "";
    return { value: avatarUrl ? { avatarUrl } : {} };
  }
  if (step === "bio") {
    const bio = typeof data === "string" ? data.trim() : "";
    if (bio.length > MAX_BIO_LENGTH) return { error: `bio must be ${MAX_BIO_LENGTH} characters or fewer` };
    return { value: bio ? { bio } : {} };
  }
  if (step === "datingGoal") {
    if (!isDatingGoal(data)) return { error: `datingGoal must be one of: ${DATING_GOALS.join(", ")}` };
    return { value: { datingGoal: data } };
  }
  if (step === "gender") {
    const option = typeof data === "object" && data !== null ? (data as { option?: unknown }).option : undefined;
    if (!isGenderOption(option)) return { error: `gender option must be one of: ${GENDER_OPTIONS.join(", ")}` };

    if (option === "custom") {
      const customText = typeof data === "object" && data !== null ? (data as { customText?: unknown }).customText : undefined;
      const trimmed = typeof customText === "string" ? customText.trim() : "";
      if (!trimmed) return { error: "Please describe your gender identity" };
      if (trimmed.length > MAX_CUSTOM_TEXT_LENGTH) return { error: `Description must be ${MAX_CUSTOM_TEXT_LENGTH} characters or fewer` };
      return { value: { gender: option, genderCustomText: trimmed } };
    }
    return { value: { gender: option, genderCustomText: undefined } };
  }
  if (step === "orientation") {
    const { option, interestedIn } = (typeof data === "object" && data !== null ? data : {}) as {
      option?: unknown;
      interestedIn?: unknown;
    };
    if (!isOrientationOption(option)) return { error: `orientation must be one of: ${ORIENTATION_OPTIONS.join(", ")}` };
    if (!Array.isArray(interestedIn) || interestedIn.length === 0 || !interestedIn.every(isGenderOption)) {
      return { error: "interestedIn must be a non-empty list of valid gender options" };
    }

    if (option === "custom") {
      const customText = (data as { customText?: unknown }).customText;
      const trimmed = typeof customText === "string" ? customText.trim() : "";
      if (!trimmed) return { error: "Please describe your orientation" };
      if (trimmed.length > MAX_CUSTOM_TEXT_LENGTH) return { error: `Description must be ${MAX_CUSTOM_TEXT_LENGTH} characters or fewer` };
      return { value: { orientation: option, orientationCustomText: trimmed, interestedIn } };
    }
    return { value: { orientation: option, orientationCustomText: undefined, interestedIn } };
  }
  if (step === "ageRange") {
    const { min, max } = (typeof data === "object" && data !== null ? data : {}) as { min?: unknown; max?: unknown };
    if (typeof min !== "number" || typeof max !== "number" || !Number.isInteger(min) || !Number.isInteger(max)) {
      return { error: "min and max must be whole numbers" };
    }
    if (min < MIN_PREFERRED_AGE || max > MAX_PREFERRED_AGE) {
      return { error: `Age range must be between ${MIN_PREFERRED_AGE} and ${MAX_PREFERRED_AGE}` };
    }
    if (min > max) return { error: "min cannot be greater than max" };
    return { value: { preferredAgeRange: { min, max } } };
  }
  if (step === "searchRadius") {
    const { radiusKm, location } = (typeof data === "object" && data !== null ? data : {}) as {
      radiusKm?: unknown;
      location?: unknown;
    };
    if (typeof radiusKm !== "number" || !Number.isInteger(radiusKm)) return { error: "radiusKm must be a whole number" };
    if (radiusKm < MIN_SEARCH_RADIUS_KM || radiusKm > MAX_SEARCH_RADIUS_KM) {
      return { error: `radiusKm must be between ${MIN_SEARCH_RADIUS_KM} and ${MAX_SEARCH_RADIUS_KM}` };
    }

    if (location === undefined || location === null) {
      return { value: { searchRadiusKm: radiusKm, location: undefined } };
    }
    const { lat, lng } = location as { lat?: unknown; lng?: unknown };
    if (typeof lat !== "number" || typeof lng !== "number" || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { error: "location must have valid lat/lng coordinates" };
    }
    return { value: { searchRadiusKm: radiusKm, location: { lat: roundCoordinate(lat), lng: roundCoordinate(lng) } } };
  }
  if (step === "selfieVerification") {
    const skipped = typeof data === "object" && data !== null && (data as { skipped?: unknown }).skipped === true;
    if (skipped) return { value: { isSelfieVerified: false } };
    return { value: { isSelfieVerified: verificationStore.isVerified(userId) } };
  }
  return { error: "Unknown step" };
}

/**
 * Server-persisted onboarding state machine: a user can close the app
 * mid-onboarding (lost connection, switched devices) and resume exactly
 * where they left off instead of restarting from scratch.
 */
export class OnboardingStore {
  private statesByUserId = new Map<string, OnboardingState>();

  constructor(private readonly verificationStore: VerificationStore) {}

  getState(userId: string): OnboardingState {
    return this.statesByUserId.get(userId) ?? { currentStep: ONBOARDING_STEPS[0], profile: {} };
  }

  submitStep(userId: string, step: OnboardingStep, data: unknown): SubmitStepResult {
    const state = this.getState(userId);
    if (state.currentStep !== step) {
      return { success: false, error: `Expected step "${state.currentStep}", got "${step}"` };
    }

    const validated = validateStepData(step, data, userId, this.verificationStore);
    if ("error" in validated) return { success: false, error: validated.error };

    const updated: OnboardingState = {
      currentStep: nextStep(step),
      profile: { ...state.profile, ...validated.value },
    };
    this.statesByUserId.set(userId, updated);
    return { success: true, state: updated };
  }
}
