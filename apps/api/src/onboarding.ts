import {
  DATING_GOALS,
  DatingGoal,
  ONBOARDING_STEPS,
  OnboardingProfile,
  OnboardingState,
  OnboardingStep,
} from "@chatapp/shared";

const MAX_DISPLAY_NAME_LENGTH = 40;
const MAX_BIO_LENGTH = 280;

export type SubmitStepResult = { success: true; state: OnboardingState } | { success: false; error: string };

function nextStep(step: OnboardingStep): OnboardingStep | "complete" {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index === ONBOARDING_STEPS.length - 1 ? "complete" : ONBOARDING_STEPS[index + 1];
}

function isDatingGoal(value: unknown): value is DatingGoal {
  return typeof value === "string" && (DATING_GOALS as readonly string[]).includes(value);
}

function validateStepData(step: OnboardingStep, data: unknown): { value: Partial<OnboardingProfile> } | { error: string } {
  if (step === "displayName") {
    const displayName = typeof data === "string" ? data.trim() : "";
    if (!displayName) return { error: "displayName is required" };
    if (displayName.length > MAX_DISPLAY_NAME_LENGTH) return { error: `displayName must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer` };
    return { value: { displayName } };
  }
  if (step === "avatar") {
    // Optional step — an empty/absent value just means "skip for now".
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
  return { error: "Unknown step" };
}

/**
 * Server-persisted onboarding state machine: a user can close the app
 * mid-onboarding (lost connection, switched devices) and resume exactly
 * where they left off instead of restarting from scratch.
 */
export class OnboardingStore {
  private statesByUserId = new Map<string, OnboardingState>();

  getState(userId: string): OnboardingState {
    return this.statesByUserId.get(userId) ?? { currentStep: ONBOARDING_STEPS[0], profile: {} };
  }

  submitStep(userId: string, step: OnboardingStep, data: unknown): SubmitStepResult {
    const state = this.getState(userId);
    if (state.currentStep !== step) {
      return { success: false, error: `Expected step "${state.currentStep}", got "${step}"` };
    }

    const validated = validateStepData(step, data);
    if ("error" in validated) return { success: false, error: validated.error };

    const updated: OnboardingState = {
      currentStep: nextStep(step),
      profile: { ...state.profile, ...validated.value },
    };
    this.statesByUserId.set(userId, updated);
    return { success: true, state: updated };
  }
}
