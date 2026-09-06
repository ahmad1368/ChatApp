export interface ChatMessage {
  id: string;
  roomId: string;
  author: string;
  text: string;
  createdAt: string;
  imageUrl?: string;
  replyToId?: string;
  replyToAuthor?: string;
  replyToText?: string;
}

export interface SendMessagePayload {
  roomId: string;
  author: string;
  text: string;
  imageUrl?: string;
  replyToId?: string;
  replyToAuthor?: string;
  replyToText?: string;
}

export const DEFAULT_ROOM_ID = "general";

export interface AuthUser {
  id: string;
  displayName: string;
  createdAt: string;
  phoneNumber?: string;
  email?: string;
  avatarUrl?: string;
  googleId?: string;
  appleId?: string;
  facebookId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface RequestOtpPayload {
  phoneNumber: string;
}

export interface VerifyOtpPayload {
  phoneNumber: string;
  code: string;
}

export const ONBOARDING_STEPS = ["displayName", "avatar", "bio", "datingGoal", "gender"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const DATING_GOALS = ["marriage", "friendship", "casual"] as const;
export type DatingGoal = (typeof DATING_GOALS)[number];

export const DATING_GOAL_LABELS: Record<DatingGoal, string> = {
  marriage: "Marriage",
  friendship: "Friendship",
  casual: "Casual chat",
};

// Deliberately broader than a binary choice, following the diverse-options
// pattern OkCupid is known for. "custom" pairs with genderCustomText for any
// identity not covered by the fixed list; "preferNotToSay" is a first-class
// option, not an afterthought.
export const GENDER_OPTIONS = [
  "woman",
  "man",
  "nonBinary",
  "transgender",
  "genderfluid",
  "genderqueer",
  "agender",
  "twoSpirit",
  "intersex",
  "custom",
  "preferNotToSay",
] as const;
export type GenderOption = (typeof GENDER_OPTIONS)[number];

export const GENDER_OPTION_LABELS: Record<GenderOption, string> = {
  woman: "Woman",
  man: "Man",
  nonBinary: "Non-binary",
  transgender: "Transgender",
  genderfluid: "Genderfluid",
  genderqueer: "Genderqueer",
  agender: "Agender",
  twoSpirit: "Two-Spirit",
  intersex: "Intersex",
  custom: "Something else",
  preferNotToSay: "Prefer not to say",
};

export interface OnboardingProfile {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  datingGoal?: DatingGoal;
  gender?: GenderOption;
  genderCustomText?: string;
}

export interface OnboardingState {
  currentStep: OnboardingStep | "complete";
  profile: OnboardingProfile;
}
