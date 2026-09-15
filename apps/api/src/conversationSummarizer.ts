import { extractKeywords } from "./bioAnalysis";

// Below this many total messages, there isn't a "long conversation" to
// summarize yet — an honest floor, same shape as #233's
// conversationCompatibility.ts and #232's bestPhotoSuggestion.ts.
const MIN_MESSAGES_FOR_SUMMARY = 10;

const TOP_KEYWORD_COUNT = 8;
const MAX_HIGHLIGHTS = 5;

// A question is worth resurfacing in a recap more than an equally long
// statement — an arbitrary, disclosed bonus, same "documented weighting"
// precedent as #220's weeklyLeaderboard.ts.
const QUESTION_HIGHLIGHT_BONUS = 5;

export interface SummarizableMessage {
  author: string;
  text: string;
  createdAt: string;
}

export interface ConversationSummary {
  messageCount: number;
  hasEnoughData: boolean;
  dateRange: { first: string; last: string } | null;
  topKeywords: string[];
  highlights: SummarizableMessage[];
}

/**
 * Hinge's real "Smart summarizer for long conversations" (#235): a real,
 * deterministic extractive summary — the most frequently discussed
 * keywords (reusing #120's `extractKeywords`) plus a handful of the
 * conversation's own highest-signal messages, picked and shown verbatim
 * in their original chronological order — rather than a fabricated
 * abstractive LLM summary this app has no model or inference
 * infrastructure for. A message's "signal" is a real, disclosed
 * heuristic (its own length, with a bonus for asking a question) — the
 * same length/heuristic school of thought as #232's engagement ranking
 * and #234's keyword matching, not a black box.
 */
export function summarizeConversation(messages: SummarizableMessage[]): ConversationSummary {
  const messageCount = messages.length;
  const hasEnoughData = messageCount >= MIN_MESSAGES_FOR_SUMMARY;

  if (!hasEnoughData) {
    return { messageCount, hasEnoughData, dateRange: null, topKeywords: [], highlights: [] };
  }

  const dateRange = { first: messages[0].createdAt, last: messages[messageCount - 1].createdAt };

  const keywordCounts = new Map<string, number>();
  for (const message of messages) {
    for (const keyword of extractKeywords(message.text)) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
  }
  const topKeywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_KEYWORD_COUNT)
    .map(([keyword]) => keyword);

  const scored = messages.map((message, index) => {
    const wordCount = message.text.trim() ? message.text.trim().split(/\s+/).length : 0;
    const score = wordCount + (message.text.includes("?") ? QUESTION_HIGHLIGHT_BONUS : 0);
    return { message, index, score };
  });
  const highlights = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_HIGHLIGHTS)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.message);

  return { messageCount, hasEnoughData, dateRange, topKeywords, highlights };
}
