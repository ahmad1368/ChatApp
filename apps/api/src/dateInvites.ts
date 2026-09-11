import { DateInvite, DATE_INVITE_RESPONSES, DateInviteResponse } from "@chatapp/shared";

export type CreateDateInviteResult = { success: true; dateInvite: DateInvite } | { success: false; error: string };
export type RespondToDateInviteResult = { success: true; dateInvite: DateInvite } | { success: false; error: string };

function isDateInviteResponse(value: unknown): value is DateInviteResponse {
  return typeof value === "string" && (DATE_INVITE_RESPONSES as readonly string[]).includes(value);
}

/**
 * Bumble's real "send a date invitation within chat" (#146) — a proposal
 * (where, when, and an optional note) attached to a chat message rather
 * than a bare text message, so it renders as its own card the recipient
 * can act on instead of just reading. Validated the same shape as #47's
 * SharedDateStore.create() validates its own location/scheduledAt fields,
 * but this is a genuinely separate feature: proposing a date *to your
 * match* inside the conversation, not sharing an already-planned date's
 * live status with third-party trusted contacts.
 */
export function createDateInvite(payload: { location?: unknown; proposedAt?: unknown; note?: unknown }): CreateDateInviteResult {
  const location = typeof payload?.location === "string" ? payload.location.trim() : "";
  if (!location) {
    return { success: false, error: "location is required" };
  }

  const proposedAtRaw = typeof payload?.proposedAt === "string" ? payload.proposedAt : "";
  const proposedAt = new Date(proposedAtRaw);
  if (!proposedAtRaw || Number.isNaN(proposedAt.getTime())) {
    return { success: false, error: "proposedAt must be a valid date/time" };
  }

  const note = typeof payload?.note === "string" ? payload.note.trim() : "";

  return {
    success: true,
    dateInvite: {
      location,
      proposedAt: proposedAt.toISOString(),
      note: note || undefined,
      status: "pending",
    },
  };
}

/**
 * Only the recipient (never the original sender) can accept or decline,
 * and only once — same "one real decision, not a do-over" stance as
 * swipes.ts's recordSwipe() rejecting a re-swipe on an already-decided
 * profile.
 */
export function respondToDateInvite(invite: DateInvite, senderAuthor: string, responder: string, response: unknown): RespondToDateInviteResult {
  if (responder === senderAuthor) {
    return { success: false, error: "Only the recipient can respond to a date invitation" };
  }
  if (invite.status !== "pending") {
    return { success: false, error: "This date invitation has already been responded to" };
  }
  if (!isDateInviteResponse(response)) {
    return { success: false, error: `response must be one of: ${DATE_INVITE_RESPONSES.join(", ")}` };
  }

  return { success: true, dateInvite: { ...invite, status: response } };
}
