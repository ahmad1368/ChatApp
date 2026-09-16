// Digit runs of typical bank-card length, allowing common space/dash
// separators (e.g. "4111 1111 1111 1111" or "4111-1111-1111-1111").
const CARD_CANDIDATE_REGEX = /\b(?:\d[ -]?){12,19}\b/g;

const MIN_CARD_DIGITS = 12;
const MAX_CARD_DIGITS = 19;

/** The standard Luhn checksum real card numbers satisfy — filters out ordinary long digit runs (tracking numbers, etc.) that aren't actually card numbers. */
function passesLuhnCheck(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export interface BankCardScanResult {
  flagged: boolean;
}

/**
 * Bumble's real "Automatic alert to prevent sharing bank card details in
 * chat" (#318) — a heuristic first-pass scan, same "regex check, not a
 * full model" honesty as scamDetector.ts's crypto-wallet/scam-phrase scan
 * and contactInfoDetector.ts's phone/address scan. Uses the real Luhn
 * checksum real card numbers satisfy to cut down false positives from
 * ordinary long digit runs (order numbers, tracking numbers) that happen
 * to be the right length — not a PCI-compliant card scanner, and it can
 * still miss unusual formats or flag a Luhn-valid non-card number.
 */
export function scanForBankCardNumber(text: string): BankCardScanResult {
  const candidates = text.match(CARD_CANDIDATE_REGEX) ?? [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/[ -]/g, "");
    if (digits.length >= MIN_CARD_DIGITS && digits.length <= MAX_CARD_DIGITS && passesLuhnCheck(digits)) {
      return { flagged: true };
    }
  }
  return { flagged: false };
}
