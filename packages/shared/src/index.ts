export interface ChatMessage {
  id: string;
  roomId: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface SendMessagePayload {
  roomId: string;
  author: string;
  text: string;
}

export const DEFAULT_ROOM_ID = "general";

export const ONBOARDING_STEPS = ["displayName", "avatar", "bio"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingProfile {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface OnboardingState {
  currentStep: OnboardingStep | "complete";
  profile: OnboardingProfile;
}
