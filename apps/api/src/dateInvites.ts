import { DateInvite, DATE_INVITE_RESPONSES, DateInviteResponse } from "@chatapp/shared";

export type CreateDateInviteResult = { success: true; dateInvite: DateInvite } | { success: false; error: string };
export type RespondToDateInviteResult = { success: true; dateInvite: DateInvite } | { success: false; error: string };
export type ConfirmDateResult = { success: true; dateInvite: DateInvite } | { success: false; error: string };

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
export function createDateInvite(
  payload: { location?: unknown; proposedAt?: unknown; note?: unknown },
  recipient?: unknown
): CreateDateInviteResult {
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
  // #277's day-of reconfirmation needs to know both parties; older
  // callers that don't pass a known recipient (a group room, or before
  // this field existed) simply never become eligible for auto-
  // cancellation — see isOverdueForConfirmation()'s doc comment.
  const recipientName = typeof recipient === "string" ? recipient.trim() : "";

  return {
    success: true,
    dateInvite: {
      location,
      proposedAt: proposedAt.toISOString(),
      note: note || undefined,
      status: "pending",
      recipient: recipientName || undefined,
      confirmedBy: [],
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

/**
 * Raya's real "Alert for date cancellation if not confirmed by both
 * parties on the day" (#277) — either side of an accepted invite can
 * reconfirm they're still on; idempotent (reconfirming twice is a no-op),
 * and only meaningful once the invite has actually been accepted.
 */
export function confirmDate(invite: DateInvite, senderAuthor: string, confirmingAuthor: string): ConfirmDateResult {
  if (invite.status !== "accepted") {
    return { success: false, error: "This date invitation hasn't been accepted yet" };
  }
  const isKnownParty =
    confirmingAuthor === senderAuthor || !invite.recipient || confirmingAuthor === invite.recipient;
  if (!isKnownParty) {
    return { success: false, error: "Only the two people in this date invitation can confirm it" };
  }

  const confirmedBy = invite.confirmedBy ?? [];
  if (confirmedBy.includes(confirmingAuthor)) {
    return { success: true, dateInvite: invite };
  }
  return { success: true, dateInvite: { ...invite, confirmedBy: [...confirmedBy, confirmingAuthor] } };
}

/** True once every party this invite actually knows about (sender, plus recipient if known) has reconfirmed. */
export function isFullyConfirmed(invite: DateInvite, senderAuthor: string): boolean {
  const confirmedBy = invite.confirmedBy ?? [];
  if (!confirmedBy.includes(senderAuthor)) return false;
  if (invite.recipient && !confirmedBy.includes(invite.recipient)) return false;
  return true;
}

/**
 * An accepted invite becomes overdue once its proposed moment actually
 * arrives without full reconfirmation — the real, checkable trigger
 * behind "on the day", rather than a vaguer calendar-date comparison.
 * An invite with no known recipient (see createDateInvite's doc comment)
 * can never be "fully confirmed" by definition here, so it's honestly
 * excluded from auto-cancellation rather than firing on a guess.
 */
export function isOverdueForConfirmation(invite: DateInvite, senderAuthor: string, now: number = Date.now()): boolean {
  if (invite.status !== "accepted") return false;
  if (!invite.recipient) return false;
  if (now < new Date(invite.proposedAt).getTime()) return false;
  return !isFullyConfirmed(invite, senderAuthor);
}
