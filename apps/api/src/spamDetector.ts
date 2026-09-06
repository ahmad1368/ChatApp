// Any link is a shared signal of promotional content pointing somewhere
// else — the same heuristic real spam filters use as a first pass.
const URL_REGEX = /\bhttps?:\/\/\S+/i;

// Common spam/promo phrasing from real dating-app spam scripts (fake
// modeling/cam-site pushes, "follow me" prompts, work-from-home schemes).
const SPAM_PHRASES = [
  "click the link in my bio",
  "check out my onlyfans",
  "dm me for a good time",
  "follow me on instagram",
  "limited time offer",
  "subscribe to my",
  "earn money from home",
  "work from home opportunity",
  "make money fast",
];

export type SpamReason = "url" | "promo_phrase";
export interface SpamScanResult {
  flagged: boolean;
  reason?: SpamReason;
}

// The reportStore has no other "system" identity — this is the sentinel
// reporterAuthor used when scanForSpamContent() auto-files a report, so
// auto-flagged reports are distinguishable from ones a real person filed.
export const SPAM_DETECTOR_REPORTER_AUTHOR = "system:spam-detector";

/**
 * Heuristic scan for spam/promotional content in chat messages. Unlike
 * scamDetector.ts's financial-scam check (which blocks the send outright),
 * this one only flags for review — Tinder's real behavior isn't to break
 * the conversation over a promotional link, it's to route it to
 * moderation (see the reportStore.submit() call this feeds in server.ts).
 */
export function scanForSpamContent(text: string): SpamScanResult {
  const lower = text.toLowerCase();
  if (SPAM_PHRASES.some((phrase) => lower.includes(phrase))) {
    return { flagged: true, reason: "promo_phrase" };
  }
  if (URL_REGEX.test(text)) {
    return { flagged: true, reason: "url" };
  }
  return { flagged: false };
}
