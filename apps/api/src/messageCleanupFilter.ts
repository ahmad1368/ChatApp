import { filterProfanity } from "./profanityFilter";
import { SPAM_PHRASES } from "./spamDetector";

export type CleanupReason = "profanity" | "spam_phrase" | "url";

export interface CleanMessageResult {
  cleaned: string;
  wasModified: boolean;
  removedReasons: CleanupReason[];
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * OkCupid's real "Smart filter to remove offensive or spam text before
 * sending" (#240): distinct from #143's contentWarning.ts (an interactive
 * "are you sure?" the sender must confirm past) and #178's spamDetector.ts
 * (a silent post-send flag to moderation, text left unchanged) — this is
 * an actual pre-send text transformation, reusing both of those modules'
 * real signals (#176's `filterProfanity` masking and spamDetector.ts's
 * own promo-phrase list) to hand back a cleaned preview the sender can
 * choose to send instead of the original, rather than a fabricated
 * toxicity-classification model this app has no training data or
 * inference infrastructure for.
 */
export function cleanMessageBeforeSending(text: string): CleanMessageResult {
  const removedReasons: CleanupReason[] = [];

  const profanityResult = filterProfanity(text);
  let cleaned = profanityResult.filtered;
  if (profanityResult.wasFiltered) removedReasons.push("profanity");

  for (const phrase of SPAM_PHRASES) {
    const beforePhraseRedaction = cleaned;
    cleaned = cleaned.replace(new RegExp(escapeForRegex(phrase), "gi"), "[removed]");
    if (cleaned !== beforePhraseRedaction) removedReasons.push("spam_phrase");
  }

  // The same real URL pattern spamDetector.ts uses to detect a link —
  // that one is a single .test() check so it has no need for the "g"
  // flag this redaction pass does.
  const beforeUrlRedaction = cleaned;
  cleaned = cleaned.replace(/\bhttps?:\/\/\S+/gi, "[link removed]");
  if (cleaned !== beforeUrlRedaction) removedReasons.push("url");

  return { cleaned, wasModified: removedReasons.length > 0, removedReasons };
}
