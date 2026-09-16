import { MessageAgeLimit } from "./messageAgeLimit";

export type MessageAgeLimitCheckResult = { allowed: true } | { allowed: false; error: string };

/**
 * Tinder's real "Ability to set an exact age limit for receiving
 * messages" (#312) — pure and data-agnostic about where the sender's age
 * and the recipient's limit come from, same shape as #135's
 * `canSendFirstMessage`. A limit with neither bound set, or a sender with
 * no self-reported age, is unrestricted — this only blocks when both a
 * real limit and a real sender age are known and the age actually falls
 * outside it.
 */
export function canSendGivenAgeLimit(senderAge: number | null, recipientLimit: MessageAgeLimit): MessageAgeLimitCheckResult {
  if (senderAge === null) return { allowed: true };
  if (recipientLimit.minAge === null && recipientLimit.maxAge === null) return { allowed: true };

  if (recipientLimit.minAge !== null && senderAge < recipientLimit.minAge) {
    return { allowed: false, error: `This person only accepts messages from ages ${recipientLimit.minAge}+` };
  }
  if (recipientLimit.maxAge !== null && senderAge > recipientLimit.maxAge) {
    return { allowed: false, error: `This person only accepts messages from ages up to ${recipientLimit.maxAge}` };
  }
  return { allowed: true };
}
