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

export const ONBOARDING_STEPS = ["displayName", "avatar", "bio", "datingGoal"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const DATING_GOALS = ["marriage", "friendship", "casual"] as const;
export type DatingGoal = (typeof DATING_GOALS)[number];

export const DATING_GOAL_LABELS: Record<DatingGoal, string> = {
  marriage: "Marriage",
  friendship: "Friendship",
  casual: "Casual chat",
};

export interface OnboardingProfile {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  datingGoal?: DatingGoal;
}

export interface OnboardingState {
  currentStep: OnboardingStep | "complete";
  profile: OnboardingProfile;
}
