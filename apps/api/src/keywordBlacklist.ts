export const MAX_KEYWORDS = 20;
const MAX_KEYWORD_LENGTH = 50;

export type UpdateKeywordBlacklistResult = { success: true; keywords: string[] } | { success: false; error: string };

/**
 * Tinder's real "Ability to define a blacklist of disliked keywords"
 * (#322) — a real substring match against a candidate's own bio text
 * (see bioContainsBlacklistedKeyword()), not a fabricated NLP topic
 * model. Enforced in server.ts's isExcludedCandidate() alongside #96's
 * discovery filters and #107's fake-profile scan: a candidate whose bio
 * mentions a blacklisted keyword never reaches the swiper's deck.
 */
export class KeywordBlacklistStore {
  private keywordsByAuthor = new Map<string, string[]>();

  update(author: unknown, keywords: unknown): UpdateKeywordBlacklistResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!Array.isArray(keywords)) {
      return { success: false, error: "keywords must be a list" };
    }
    if (keywords.length > MAX_KEYWORDS) {
      return { success: false, error: `You can blacklist at most ${MAX_KEYWORDS} keywords` };
    }

    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const entry of keywords) {
      if (typeof entry !== "string") {
        return { success: false, error: "Each keyword must be a string" };
      }
      const trimmed = entry.trim().toLowerCase();
      if (!trimmed) continue;
      if (trimmed.length > MAX_KEYWORD_LENGTH) {
        return { success: false, error: `Each keyword must be ${MAX_KEYWORD_LENGTH} characters or fewer` };
      }
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      normalized.push(trimmed);
    }

    this.keywordsByAuthor.set(authorName, normalized);
    return { success: true, keywords: normalized };
  }

  get(author: string): string[] {
    return this.keywordsByAuthor.get(author) ?? [];
  }
}

export function bioContainsBlacklistedKeyword(bio: string, keywords: string[]): boolean {
  if (!bio || keywords.length === 0) return false;
  const lowerBio = bio.toLowerCase();
  return keywords.some((keyword) => lowerBio.includes(keyword));
}
