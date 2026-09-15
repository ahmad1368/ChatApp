import { extractKeywords } from "./bioAnalysis";

const MIN_GOOD_WORD_COUNT = 15;
const MAX_GOOD_WORD_COUNT = 150;
const MIN_GOOD_KEYWORD_COUNT = 5;

// A representative list of dating-bio filler phrases, not an exhaustive
// database — same "honest heuristic, not a fabricated model" scoping call
// as bioAnalysis.ts's stopword list.
const CLICHE_PHRASES = [
  "love to travel",
  "love traveling",
  "foodie",
  "netflix and chill",
  "just ask",
  "work hard play hard",
  "adventure is out there",
  "living my best life",
  "swipe right",
  "down to earth",
  "looking for my partner in crime",
  "not looking for hookups",
];

export interface BioAnalysis {
  score: number;
  wordCount: number;
  hasQuestion: boolean;
  clichesFound: string[];
  keywordCount: number;
  tips: string[];
}

/**
 * Hinge's real "Personal AI assistant for writing an optimized bio"
 * (#231), implemented as an honest, deterministic rule-based feedback
 * engine rather than an invented LLM integration — same scoping call as
 * #120's bioAnalysis.ts and #107's fakeProfileDetector.ts, both
 * explicitly real, explainable signals rather than a fabricated "AI"
 * black box this app has no model, API key, or inference infrastructure
 * for. Every point of the score traces to a concrete, disclosed rule, and
 * every tip names the specific thing to change — the actual "assistant"
 * this feature promises, without pretending to call out to a model that
 * doesn't exist here.
 */
export function analyzeBio(bio: string): BioAnalysis {
  const trimmed = bio.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const hasQuestion = trimmed.includes("?");
  const lowerBio = trimmed.toLowerCase();
  const clichesFound = CLICHE_PHRASES.filter((phrase) => lowerBio.includes(phrase));
  const keywordCount = extractKeywords(trimmed).length;

  let score = 50;
  const tips: string[] = [];

  if (wordCount === 0) {
    tips.push("Your bio is empty — add a few sentences about yourself to get started.");
    score = 0;
  } else {
    if (wordCount < MIN_GOOD_WORD_COUNT) {
      score -= 15;
      tips.push("Add more detail — aim for at least a couple of sentences so people have something to reply to.");
    } else if (wordCount > MAX_GOOD_WORD_COUNT) {
      score -= 10;
      tips.push("Trim it down a bit — a long bio can be harder to skim.");
    } else {
      score += 20;
    }

    if (hasQuestion) {
      score += 15;
    } else {
      tips.push("End with a question — bios that ask something tend to get more replies.");
    }

    if (clichesFound.length > 0) {
      score -= Math.min(15, clichesFound.length * 5);
      tips.push(`Swap out generic phrases like "${clichesFound[0]}" for something more specific to you.`);
    }

    if (keywordCount >= MIN_GOOD_KEYWORD_COUNT) {
      score += 10;
    } else {
      tips.push("Mention specific interests, hobbies, or plans instead of general statements.");
    }

    if (tips.length === 0) {
      tips.push("This bio looks strong — specific, inviting, and easy to reply to.");
    }
  }

  return { score: Math.max(0, Math.min(100, score)), wordCount, hasQuestion, clichesFound, keywordCount, tips };
}
