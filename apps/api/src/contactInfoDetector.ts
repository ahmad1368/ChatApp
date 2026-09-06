// Runs of 7+ digits (allowing common phone-number separators) — enough to
// catch a phone number without also catching short numbers like an age or a
// house number on its own.
const DIGIT_RUN_REGEX = /(?:\+?\d[\d\-.\s()]{5,}\d)/g;
const MIN_PHONE_DIGITS = 7;

// A house/building number followed by a street-type word — the same
// heuristic real moderation tooling uses for a first pass, with the same
// caveat: it can miss unusual formats and can flag a street name mentioned
// for an unrelated reason. It only ever *warns*, never silently strips.
const ADDRESS_REGEX =
  /\b\d{1,5}\s+([A-Za-z0-9.]+\s){0,4}(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl)\b/i;

export interface ContactInfoScanResult {
  containsPhoneNumber: boolean;
  containsAddress: boolean;
}

/**
 * Heuristic scan for phone numbers and street addresses in free-text
 * profile fields (bio, display name) — Bumble's real "we don't allow
 * contact info in your profile" moderation, reimplemented as a first-pass
 * regex check rather than a full NLP model. False positives/negatives are
 * expected; this blocks saving with an editable error rather than silently
 * rewriting what the user wrote.
 */
export function scanForContactInfo(text: string): ContactInfoScanResult {
  const digitRuns = text.match(DIGIT_RUN_REGEX) ?? [];
  const containsPhoneNumber = digitRuns.some((run) => run.replace(/\D/g, "").length >= MIN_PHONE_DIGITS);
  const containsAddress = ADDRESS_REGEX.test(text);
  return { containsPhoneNumber, containsAddress };
}
