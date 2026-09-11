export interface ChatMessage {
  id: string;
  roomId: string;
  author: string;
  text: string;
  createdAt: string;
  imageUrl?: string;
  // Badoo's real voice-note messages with a waveform (#122): audioUrl
  // points at the uploaded clip (see voiceNotes.ts), waveform is the
  // client-computed amplitude sketch carried alongside it so a recipient
  // can render the waveform without a second fetch.
  audioUrl?: string;
  waveform?: number[];
  // Bumble/Snapchat-style "view once, then gone" chat photo (#123) —
  // distinct from imageUrl since this one hits a view-destroys-it
  // endpoint (see selfDestructPhotos.ts) rather than a permanently
  // viewable upload.
  selfDestructImageUrl?: string;
  // WhatsApp/Bumble's real "send live or text location" (#127) — every
  // share carries real coordinates (an optional `label` covers the "text"
  // half: a plain description like "Central Park" attached to the pin,
  // rather than a fabricated geocoding lookup); `live` sharers keep
  // updating `latitude`/`longitude` via the location:update socket event
  // until `expiresAt` (see liveLocationShares.ts for why a static share
  // needs none of that server-side tracking).
  location?: ChatLocationShare;
  replyToId?: string;
  replyToAuthor?: string;
  replyToText?: string;
  // Bumble's real "edit a sent message" (#133) — set once a message:edit
  // succeeds; see messageEditing.ts for the sender-only/time-window/
  // text-only-message rules.
  edited?: boolean;
  // WhatsApp/Bumble's real "Delete for Everyone" (#134) — set once a
  // message:delete succeeds; see messageDeletion.ts. The client renders a
  // placeholder instead of whatever content fields were originally set.
  deleted?: boolean;
  // Snapchat/Bumble's real "play a mini-game within chat to break the
  // ice" (#148) — a genuinely playable two-player Tic-Tac-Toe game (see
  // ticTacToe.ts) attached to the message that started it, mutated in
  // place as moves come in (see server.ts's game:move) the same way
  // #146's dateInvite is mutated by date-invite:respond.
  game?: TicTacToeGame;
  // Bumble's real "suggest a type of date" quick-reply chip (#147) — a
  // lightweight themed prompt (see dateProposals.ts's catalog), distinct
  // from #146's dateInvite: no location/time/RSVP, just a low-stakes
  // conversation-starting suggestion either side can send or ignore.
  dateProposalCategory?: DateProposalCategory;
  // Bumble's real "send a date invitation within chat" (#146) — a special
  // message carrying a proposed real-world meetup instead of plain text.
  // `status` starts "pending" and is updated in place (see server.ts's
  // date-invite:respond) once the recipient accepts/declines, so the
  // card's outcome persists across reloads the same way #133's edited/
  // #134's deleted messages do.
  dateInvite?: DateInvite;
  // Bumble's real "Private Detector" AI photo warning (#144) — set
  // server-side (see server.ts's message:send) for an `imageUrl` message
  // whose sender is a real safety signal this app already tracks (enough
  // reports — fakeProfileDetector.ts's REPORT_THRESHOLD/ReportStore, this
  // app's honest stand-in for a trained NSFW-image classifier it has no
  // vision model for), never based on inspecting the actual pixel content.
  // The client blurs the photo behind a tap-to-view warning instead of
  // rendering it immediately. Scoped to plain imageUrl messages only —
  // #123's selfDestructImageUrl already gates behind its own tap-to-reveal.
  suspicious?: boolean;
}

export const TIC_TAC_TOE_MARKS = ["X", "O"] as const;
export type TicTacToeMark = (typeof TIC_TAC_TOE_MARKS)[number];
export type TicTacToeCell = TicTacToeMark | null;

export interface TicTacToeGame {
  board: TicTacToeCell[];
  playerX: string;
  playerO: string;
  turn: TicTacToeMark;
  winner: TicTacToeMark | "draw" | null;
}

export const DATE_INVITE_RESPONSES = ["accepted", "declined"] as const;
export type DateInviteResponse = (typeof DATE_INVITE_RESPONSES)[number];
export type DateInviteStatus = "pending" | DateInviteResponse;

export interface DateInvite {
  location: string;
  proposedAt: string;
  note?: string;
  status: DateInviteStatus;
}

export const DATE_PROPOSAL_CATEGORIES = ["cinema", "cafe", "restaurant", "park", "drinks"] as const;
export type DateProposalCategory = (typeof DATE_PROPOSAL_CATEGORIES)[number];

// Shared between server (validation + the message-text fallback in
// server.ts) and client (the composer's suggestion chips) so the two
// never drift apart, same "labels live alongside the enum" shape as
// REPORT_REASON_LABELS below.
export const DATE_PROPOSAL_LABELS: Record<DateProposalCategory, string> = {
  cinema: "How about a movie? 🎬",
  cafe: "How about coffee? ☕",
  restaurant: "How about dinner? 🍽️",
  park: "How about a walk in the park? 🌳",
  drinks: "How about drinks? 🍸",
};

export interface ChatLocationShare {
  latitude: number;
  longitude: number;
  label?: string;
  live: boolean;
  expiresAt?: string;
  // Client → server only on the initial send of a live share; the server
  // computes and echoes back the authoritative `expiresAt` above.
  durationMinutes?: number;
}

export interface SendMessagePayload {
  roomId: string;
  author: string;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  waveform?: number[];
  selfDestructImageUrl?: string;
  location?: ChatLocationShare;
  replyToId?: string;
  replyToAuthor?: string;
  replyToText?: string;
  // Bumble's real "suggest a type of date" quick-reply chip (#147) — see
  // dateProposals.ts for the fixed category catalog this is validated
  // against.
  dateProposalCategory?: DateProposalCategory;
  // Bumble's real "send a date invitation within chat" (#146) — client
  // sends only the proposal fields; the server validates them and sets
  // the authoritative `status: "pending"` (see server.ts's message:send
  // and dateInvites.ts's createDateInvite).
  dateInvite?: { location: string; proposedAt: string; note?: string };
  // Self-reported by the client — see the trust-boundary note in
  // apps/api/src/server.ts (same limitation as #26-#37's :userId trust:
  // there's no merged auth session yet to verify this against). The
  // client already hides the send UI for guests; this is defense in
  // depth for a request that bypasses the UI.
  asGuest?: boolean;
  // Bumble's real "women message first" rule (#135) — the other person
  // in a fresh 1:1 match, so the server can look up both sides' gender
  // and enforce it on the very first message only. Optional: this app's
  // rooms otherwise have no formal "these two people only" concept, so
  // omitting it (a group room, or an already-started conversation) just
  // skips the check.
  recipient?: string;
  // Snapchat/Bumble's real "play a mini-game within chat" (#148) — starts
  // a new Tic-Tac-Toe game against `recipient` (required: a two-player
  // game needs a known second player, same reasoning as #135 only
  // applying with a recipient). See ticTacToe.ts's createGame().
  startGame?: boolean;
  // Bumble's real "unkind message" AI warning (#143) — set only by the
  // client's own "Send anyway" action after the server's message:warning
  // prompted the sender to confirm a flagged message. Never set by the
  // initial send attempt.
  overrideWarning?: boolean;
}

export const DEFAULT_ROOM_ID = "general";

export interface EmergencyContact {
  name: string;
  contactMethod: string;
}

export interface SOSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface SOSAlert {
  id: string;
  author: string;
  location: SOSLocation;
  resolved: boolean;
  triggeredAt: string;
  updatedAt: string;
  contacts: { name: string; shareCode: string }[];
}

export interface SOSAlertView {
  author: string;
  location: SOSLocation;
  resolved: boolean;
  triggeredAt: string;
  updatedAt: string;
}

export const DATE_STATUSES = ["planned", "on_the_way", "arrived", "safe", "need_help"] as const;
export type DateStatus = (typeof DATE_STATUSES)[number];

export const DATE_STATUS_LABELS: Record<DateStatus, string> = {
  planned: "Planned",
  on_the_way: "On the way",
  arrived: "Arrived",
  safe: "Safe",
  need_help: "Needs help",
};

export interface TrustedContactInfo {
  name: string;
  shareCode: string;
}

export interface SharedDatePayload {
  author: string;
  meetingWith: string;
  location: string;
  scheduledAt: string;
  contactNames: string[];
}

export interface SharedDate {
  id: string;
  author: string;
  meetingWith: string;
  location: string;
  scheduledAt: string;
  status: DateStatus;
  revoked: boolean;
  createdAt: string;
  contacts: TrustedContactInfo[];
}

export interface SharedDateView {
  author: string;
  meetingWith: string;
  location: string;
  scheduledAt: string;
  status: DateStatus;
  createdAt: string;
}

// #46's SafetyPlanStore/MeetupPlan (single static link) has been retired in
// favor of SharedDateStore/SharedDate above (multiple named trusted
// contacts, live status, revocation) — see CLAUDE.md's #46/#47
// reconciliation note. SafetyCenter.tsx now points at /share-my-date
// instead of its own form.
export const SAFETY_TIPS: string[] = [
  "Meet in a public place for the first few dates.",
  "Tell a friend or family member where you're going, who you're meeting, and when you expect to be back.",
  "Video chat before meeting in person to confirm they're who they say they are.",
  "Arrange your own transportation to and from the date.",
  "Stay sober enough to stay aware of your surroundings.",
  "Trust your instincts — if something feels off, it's okay to leave.",
  "Keep your phone charged and easily accessible.",
];

export interface WatermarkSession {
  traceCode: string;
  author: string;
  roomId: string;
  issuedAt: string;
}

export interface BlockPayload {
  blockerAuthor: string;
  blockedAuthor: string;
}

export interface BlockRecord extends BlockPayload {
  createdAt: string;
}

// Categorized report reasons — matches the "Report" half of Bumble's
// Report/Block/SOS safety trio (Block and SOS are separate issues).
export const REPORT_REASONS = [
  "harassment",
  "hateSpeech",
  "spam",
  "fakeProfile",
  "inappropriateContent",
  "underage",
  "scam",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment or bullying",
  hateSpeech: "Hate speech",
  spam: "Spam",
  fakeProfile: "Fake profile",
  inappropriateContent: "Inappropriate content",
  underage: "Underage user",
  scam: "Scam or fraud",
  other: "Something else",
};

export interface ReportPayload {
  reportedAuthor: string;
  messageId?: string;
  reason: ReportReason;
  details?: string;
}

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

// communityGuidelines comes first, matching Tinder's actual flow: consent
// is collected up front, before any profile information, not tacked on at
// the end.
export const ONBOARDING_STEPS = [
  "communityGuidelines",
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

// Bumped whenever the guidelines text materially changes, so re-acceptance
// can be required from existing users in the future without touching the
// onboarding step logic itself.
export const COMMUNITY_GUIDELINES_VERSION = 1;

export interface OnboardingProfile {
  acceptedCommunityGuidelinesVersion?: number;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  datingGoal?: DatingGoal;
  gender?: GenderOption;
  genderCustomText?: string;
  orientation?: OrientationOption;
  orientationCustomText?: string;
  // Who they'd like to be matched with — reuses GENDER_OPTIONS so "everyone"
  // is just "select all" rather than a separate special case.
  interestedIn?: GenderOption[];
  preferredAgeRange?: AgeRange;
  searchRadiusKm?: number;
  location?: CoarseLocation;
  // Deliberately just a boolean — the verification selfie itself is never
  // exposed through the onboarding state or any public profile field. See
  // apps/api/src/verification.ts.
  isSelfieVerified?: boolean;
}

export interface OnboardingState {
  currentStep: OnboardingStep | "complete";
  profile: OnboardingProfile;
}
