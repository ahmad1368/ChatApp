// Common hostile/threatening phrasing — a first-pass keyword heuristic,
// same honest scoping as scamDetector.ts/spamDetector.ts (a real "AI"
// warning like Bumble's actual "unkind message" detector would need a
// trained toxicity/NLP model this app has neither the training data nor
// the infra for). Deliberately targeted multi-word phrases and standalone
// slurs/insults rather than words that come up in ordinary heated
// conversation ("hate", "stupid", "shut up" on their own are too common
// to flag without drowning the signal in false positives).
const HARASSMENT_PHRASES = [
  "kill yourself",
  "kys",
  "i'll kill you",
  "i will kill you",
  "you're worthless",
  "you are worthless",
  "nobody would miss you",
  "go die",
  "hope you die",
];

// Standalone profanity/insults, matched as whole words so this doesn't
// trip on unrelated substrings (e.g. "class", "assassin"). Exported for
// profanityFilter.ts's #176 automatic filter, which reuses this exact
// list for a different mechanism (silent masking of profile text)
// instead of duplicating it.
export const PROFANITY_WORDS = ["fuck", "fucking", "shit", "bitch", "asshole", "bastard", "slut", "whore", "cunt"];

export type ContentWarningReason = "harassment" | "profanity";
export interface ContentWarningScanResult {
  flagged: boolean;
  reason?: ContentWarningReason;
}

// The reportStore has no other "system" identity — this sentinel
// reporterAuthor marks a report auto-filed after a sender chose "Send
// anyway" past this warning, same pattern as spamDetector.ts's own
// SPAM_DETECTOR_REPORTER_AUTHOR.
export const CONTENT_WARNING_REPORTER_AUTHOR = "system:content-warning";

/**
 * Bumble's real AI warning shown when a message might be considered rude
 * or unkind before it's sent (#143). Unlike scamDetector.ts's hard block
 * or spamDetector.ts's silent auto-report, this is a soft nudge: flagging
 * here doesn't reject the message outright — see message:send in
 * server.ts, which asks the sender to confirm before it goes through.
 */
export function scanForInappropriateContent(text: string): ContentWarningScanResult {
  const lower = text.toLowerCase();
  if (HARASSMENT_PHRASES.some((phrase) => lower.includes(phrase))) {
    return { flagged: true, reason: "harassment" };
  }

  const words: string[] = lower.match(/[a-z']+/g) ?? [];
  if (PROFANITY_WORDS.some((word) => words.includes(word))) {
    return { flagged: true, reason: "profanity" };
  }

  return { flagged: false };
}
