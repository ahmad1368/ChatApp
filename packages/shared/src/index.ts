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

export const ONBOARDING_STEPS = [
  "displayName",
  "avatar",
  "bio",
  "datingGoal",
  "gender",
  "orientation",
  "ageRange",
  "searchRadius",
  "selfieVerification",
] as const;
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

// Same inclusivity approach as GENDER_OPTIONS: a broad fixed list plus a
// custom free-text escape hatch and an explicit "prefer not to say".
export const ORIENTATION_OPTIONS = [
  "straight",
  "gay",
  "lesbian",
  "bisexual",
  "pansexual",
  "asexual",
  "demisexual",
  "queer",
  "questioning",
  "custom",
  "preferNotToSay",
] as const;
export type OrientationOption = (typeof ORIENTATION_OPTIONS)[number];

export const ORIENTATION_OPTION_LABELS: Record<OrientationOption, string> = {
  straight: "Straight",
  gay: "Gay",
  lesbian: "Lesbian",
  bisexual: "Bisexual",
  pansexual: "Pansexual",
  asexual: "Asexual",
  demisexual: "Demisexual",
  queer: "Queer",
  questioning: "Questioning",
  custom: "Something else",
  preferNotToSay: "Prefer not to say",
};

// Legal minimum for a dating app; 99 stands in for "no upper limit" without
// making range-slider math handle Infinity.
export const MIN_PREFERRED_AGE = 18;
export const MAX_PREFERRED_AGE = 99;

export interface AgeRange {
  min: number;
  max: number;
}

export const MIN_SEARCH_RADIUS_KM = 1;
export const MAX_SEARCH_RADIUS_KM = 160; // ~100 miles, doubling as "anywhere"

// Deliberately coarse — see onboarding.ts's rounding. Never store or expose
// a user's exact coordinates; a few hundred meters of imprecision is enough
// to compute "nearby" without pinpointing someone's location.
export interface CoarseLocation {
  lat: number;
  lng: number;
}

export interface OnboardingProfile {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  datingGoal?: DatingGoal;
  gender?: GenderOption;
  genderCustomText?: string;
  orientation?: OrientationOption;
  orientationCustomText?: string;
  interestedIn?: GenderOption[];
  preferredAgeRange?: AgeRange;
  searchRadiusKm?: number;
  location?: CoarseLocation;
  isSelfieVerified?: boolean;
}

export interface OnboardingState {
  currentStep: OnboardingStep | "complete";
  profile: OnboardingProfile;
}
