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
