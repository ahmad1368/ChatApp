import { REAL_GIFT_CATALOG, RealGiftIdea, RealGiftSuggestion } from "@chatapp/shared";

/**
 * Coffee Meets Bagel's real "System to suggest real gifts through
 * partner stores" (#272) — a genuinely real, live outbound link (Amazon's
 * own public product-search URL, no API key or partner credentials
 * needed), not a fabricated catalog-fetching integration this app has no
 * commerce API access for. Same "server builds the authoritative link
 * from a client-sent catalog id" trust boundary as #147's
 * dateProposalCategory and #197's giftId.
 */
export function findRealGiftIdea(id: unknown): RealGiftIdea | undefined {
  return REAL_GIFT_CATALOG.find((idea) => idea.id === id);
}

export function buildPartnerStoreUrl(searchQuery: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}`;
}

export function buildRealGiftSuggestion(idea: RealGiftIdea): RealGiftSuggestion {
  return { id: idea.id, name: idea.name, emoji: idea.emoji, storeUrl: buildPartnerStoreUrl(idea.searchQuery) };
}
