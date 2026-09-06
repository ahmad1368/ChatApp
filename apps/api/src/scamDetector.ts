// Legacy (base58) and bech32 Bitcoin addresses, and Ethereum addresses —
// pasting a wallet address into chat is the single most common financial-
// scam pattern (Bumble's own stated policy explicitly calls this out).
const BTC_LEGACY_ADDRESS_REGEX = /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/;
const BTC_BECH32_ADDRESS_REGEX = /\bbc1[a-z0-9]{25,39}\b/i;
const ETH_ADDRESS_REGEX = /\b0x[a-fA-F0-9]{40}\b/;

// Common phrasing from real romance/investment scam scripts. Deliberately
// specific multi-word phrases rather than single words like "crypto" or
// "invest", which come up in ordinary conversation.
const SCAM_PHRASES = [
  "guaranteed return",
  "guaranteed profit",
  "double your money",
  "double your investment",
  "investment opportunity",
  "crypto investment",
  "forex trading",
  "binary options",
  "wire transfer",
  "send bitcoin",
  "send crypto",
  "risk-free investment",
  "no-risk investment",
  "trading signals",
  "financial freedom",
];

export type ScamReason = "crypto_wallet_address" | "scam_phrase";
export interface ScamScanResult {
  flagged: boolean;
  reason?: ScamReason;
}

/**
 * Heuristic scan for financial/crypto scam content in chat messages —
 * Bumble's real strict policy against these, reimplemented as a first-pass
 * regex/keyword check rather than a full fraud-detection model. Its own
 * dependency-free check, same as guestMode.ts's isGuestSendAllowed(), so
 * the socket handler stays a pure pipeline of independent checks.
 */
export function scanForScamContent(text: string): ScamScanResult {
  if (
    BTC_LEGACY_ADDRESS_REGEX.test(text) ||
    BTC_BECH32_ADDRESS_REGEX.test(text) ||
    ETH_ADDRESS_REGEX.test(text)
  ) {
    return { flagged: true, reason: "crypto_wallet_address" };
  }

  const lower = text.toLowerCase();
  if (SCAM_PHRASES.some((phrase) => lower.includes(phrase))) {
    return { flagged: true, reason: "scam_phrase" };
  }

  return { flagged: false };
}
