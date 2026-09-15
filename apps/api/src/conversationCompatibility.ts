import { extractKeywords } from "./bioAnalysis";
import { computeInterestCompatibility } from "./interestCompatibility";

// Below this many messages from either side, there isn't enough real
// conversation to say anything — same "no fabricated opinion" floor as
// #232's bestPhotoSuggestion.ts.
const MIN_MESSAGES_PER_AUTHOR = 3;

// A 50% question-asking rate is already unusually curious for a chat —
// capping the curiosity score there (rather than at 100%) keeps a
// realistic conversation able to reach a full score. An arbitrary,
// disclosed choice, same as #220's weeklyLeaderboard.ts weighting.
const CURIOSITY_RATIO_CAP = 0.5;

export interface ConversationMessage {
  author: string;
  text: string;
}

export interface ConversationCompatibility {
  messageCountA: number;
  messageCountB: number;
  hasEnoughData: boolean;
  balanceScore: number;
  curiosityScore: number;
  topicOverlapScore: number;
  sharedKeywords: string[];
  avgMessageLengthA: number;
  avgMessageLengthB: number;
  compatibilityScore: number;
}

function averageWordCount(messages: string[]): number {
  if (messages.length === 0) return 0;
  const totalWords = messages.reduce((sum, text) => sum + (text.trim() ? text.trim().split(/\s+/).length : 0), 0);
  return totalWords / messages.length;
}

function questionRatio(messages: string[]): number {
  if (messages.length === 0) return 0;
  return messages.filter((text) => text.includes("?")).length / messages.length;
}

/**
 * OkCupid's real "Smart analysis of personality compatibility based on
 * conversations" (#233): an honest, deterministic analysis of the two
 * people's *actual* chat history, not a fabricated LLM personality
 * profiler this app has no model or inference infrastructure for.
 * Distinct from #94/#118-120's static profile-based compatibility (
 * interests, music, bios) — those never look at how two people actually
 * talk to each other. Three real, explainable signals, equally weighted
 * (an arbitrary but disclosed choice): how balanced the conversation is
 * (nobody carrying it alone), how much mutual curiosity there is
 * (question-asking), and how much conversational topic overlap there is
 * (reusing #94's `computeInterestCompatibility` over each side's
 * extracted keywords, same as #120's bio matching). Average message
 * length is reported but deliberately left out of the score — it's an
 * effort signal worth showing, not a compatibility one.
 */
export function analyzeConversationCompatibility(
  messages: ConversationMessage[],
  authorA: string,
  authorB: string
): ConversationCompatibility {
  const textsA = messages.filter((m) => m.author === authorA).map((m) => m.text);
  const textsB = messages.filter((m) => m.author === authorB).map((m) => m.text);

  const messageCountA = textsA.length;
  const messageCountB = textsB.length;
  const hasEnoughData = messageCountA >= MIN_MESSAGES_PER_AUTHOR && messageCountB >= MIN_MESSAGES_PER_AUTHOR;

  const total = messageCountA + messageCountB;
  const balanceScore = total === 0 ? 0 : Math.round(100 - (Math.abs(messageCountA - messageCountB) / total) * 100);

  const avgQuestionRatio = (questionRatio(textsA) + questionRatio(textsB)) / 2;
  const curiosityScore = Math.round(Math.min(100, (avgQuestionRatio / CURIOSITY_RATIO_CAP) * 100));

  const keywordsA = extractKeywords(textsA.join(" "));
  const keywordsB = extractKeywords(textsB.join(" "));
  const setB = new Set(keywordsB);
  const sharedKeywords = keywordsA.filter((keyword) => setB.has(keyword));
  const topicOverlapScore = computeInterestCompatibility(keywordsA, keywordsB);

  const compatibilityScore = hasEnoughData ? Math.round((balanceScore + curiosityScore + topicOverlapScore) / 3) : 0;

  return {
    messageCountA,
    messageCountB,
    hasEnoughData,
    balanceScore,
    curiosityScore,
    topicOverlapScore,
    sharedKeywords,
    avgMessageLengthA: averageWordCount(textsA),
    avgMessageLengthB: averageWordCount(textsB),
    compatibilityScore,
  };
}
