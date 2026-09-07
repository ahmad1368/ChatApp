import { computeInterestCompatibility } from "./interestCompatibility";

// A representative stopword list rather than a full NLP stopword corpus or
// dependency — same "honest heuristic, not a fabricated model" scoping
// call as fakeProfileDetector.ts and smartScore.ts's Elo-style rating.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at", "for", "with", "is",
  "am", "are", "was", "were", "be", "been", "being", "i", "you", "he", "she", "it", "we", "they",
  "my", "your", "his", "her", "its", "our", "their", "this", "that", "these", "those", "not",
  "no", "so", "just", "very", "really", "also", "here", "there", "as", "by", "from", "up", "out",
  "about", "into", "over", "than", "then", "too", "can", "will", "would", "could", "should",
  "do", "does", "did", "have", "has", "had", "me", "im",
]);

const MIN_KEYWORD_LENGTH = 3;

/**
 * "AI-powered" bio matching (#120), implemented as an honest keyword-
 * extraction heuristic rather than an invented LLM/NLP-model integration —
 * same scoping call as smartScore.ts's Elo-style rating and #107's
 * fakeProfileDetector.ts, both explicitly real, explainable signals rather
 * than a fabricated "AI" black box this app has no model, API key, or
 * inference infrastructure for. Words are lowercased, stripped of
 * punctuation, filtered against a stopword list and a minimum length, and
 * deduped — the resulting keyword set is the actual "content analysis"
 * this feature promises.
 */
export function extractKeywords(bio: string): string[] {
  const words = bio
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= MIN_KEYWORD_LENGTH && !STOPWORDS.has(word));
  return Array.from(new Set(words));
}

export interface BioMatch {
  sharedKeywords: string[];
  compatibility: number;
}

/**
 * Reuses #94's generic percentage-overlap formula (`computeInterest
 * Compatibility`) over each bio's extracted keyword set, same shape as
 * #118/#119's music/weekend-plan matches — surfaces WHICH words two bios
 * have in common, not just a score.
 */
export function computeBioMatch(bioA: string, bioB: string): BioMatch {
  const keywordsA = extractKeywords(bioA);
  const keywordsB = extractKeywords(bioB);
  const setB = new Set(keywordsB);
  const sharedKeywords = keywordsA.filter((keyword) => setB.has(keyword));
  return { sharedKeywords, compatibility: computeInterestCompatibility(keywordsA, keywordsB) };
}
