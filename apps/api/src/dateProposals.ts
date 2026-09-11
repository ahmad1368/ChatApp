import { DATE_PROPOSAL_CATEGORIES, DateProposalCategory } from "@chatapp/shared";

export { DATE_PROPOSAL_LABELS } from "@chatapp/shared";

/**
 * Bumble's real "suggest a type of date" quick-reply chip (#147) — a
 * small fixed catalog of low-stakes date-idea prompts (labels live in
 * @chatapp/shared so server and client never drift apart), same
 * finite-catalog shape as profilePrompts.ts's PROFILE_PROMPT_CATALOG.
 * Deliberately lighter-weight than #146's dateInvite: no location, no
 * time, no accept/decline RSVP — just a themed conversation starter
 * either side can send or ignore, closer in spirit to #132's Icebreaker
 * suggestions than to a firm meetup proposal.
 */
export function isDateProposalCategory(value: unknown): value is DateProposalCategory {
  return typeof value === "string" && (DATE_PROPOSAL_CATEGORIES as readonly string[]).includes(value);
}
