export type MatchConfidence = "low" | "medium" | "high";

export interface MatchSignal {
  label: string;
  score: number;
  weight: number;
}

export interface MatchProbabilityResult {
  hasEnoughData: boolean;
  probability: number;
  confidence: MatchConfidence;
  signals: MatchSignal[];
}

// Below this many available real signals, a composite score would be
// resting on too little to call it a probability at all — an honest
// floor, same shape as #233's conversationCompatibility.ts and #235's
// conversationSummarizer.ts.
const MIN_SIGNALS = 2;

/**
 * eHarmony's real "Predict relationship success probability (Match
 * Probability Score)" (#238): a weighted composite of every real
 * compatibility signal this app already computes honestly — #94's
 * interest overlap, #118's music match, #119's weekend-plan match,
 * #120's bio keyword match, and #233's actual conversation compatibility
 * when a chat exists — rather than a fabricated single "AI prediction"
 * model this app has no inference infrastructure for. Each signal keeps
 * its own real score; only the combining weights here are a genuine
 * editorial choice (disclosed, not hidden), and the result's confidence
 * level honestly reflects how many of those signals were actually
 * available for this pair rather than presenting a score backed by one
 * data point with the same certainty as one backed by five.
 */
export function computeMatchProbability(signals: MatchSignal[]): MatchProbabilityResult {
  const hasEnoughData = signals.length >= MIN_SIGNALS;
  if (!hasEnoughData) {
    return { hasEnoughData, probability: 0, confidence: "low", signals };
  }

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const probability = Math.round(signals.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight);

  const confidence: MatchConfidence = signals.length >= 4 ? "high" : signals.length >= 3 ? "medium" : "low";

  return { hasEnoughData, probability, confidence, signals };
}
