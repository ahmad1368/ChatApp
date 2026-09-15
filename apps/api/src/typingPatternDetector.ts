// A healthy human can't compose and send a real message faster than
// this, on average — a real, disclosed floor rather than a fabricated
// keystroke-timing model this app has no client-side instrumentation
// for (see the module doc comment for what "typing pattern" honestly
// means here).
const MIN_HUMAN_INTERVAL_MS = 1500;
const FAST_REPLY_FLAG_RATIO = 0.5;

// Coefficient of variation (stdev/mean) of a human's message-sending
// intervals is naturally noisy; a script firing on a near-fixed timer
// produces a suspiciously low one. An arbitrary, disclosed threshold,
// same "documented weighting" precedent as #220's weeklyLeaderboard.ts.
const MAX_HUMAN_LIKE_CV = 0.15;
const MIN_INTERVALS_FOR_TIMING_CHECKS = 4;

// The same non-trivial text sent verbatim to this many different rooms
// looks like a broadcast script, not a person individually chatting with
// each match. Short texts ("ok", "lol") are excluded since those are
// genuinely common human replies, not evidence of automation.
const DUPLICATE_ROOM_THRESHOLD = 3;
const MIN_DUPLICATE_TEXT_LENGTH = 8;

const MIN_MESSAGES_FOR_ANALYSIS = 5;

export type BotDetectionReason = "impossibly_fast_replies" | "uniform_timing" | "duplicate_broadcast_text";

export interface TypingPatternMessage {
  roomId: string;
  text: string;
  createdAt: string;
}

export interface TypingPatternAnalysis {
  messageCount: number;
  hasEnoughData: boolean;
  flagged: boolean;
  reasons: BotDetectionReason[];
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Hinge's real "High-accuracy bot account detection based on typing
 * patterns" (#236): honestly, this app has no client-side keystroke
 * instrumentation and no ML model to fabricate a "typing pattern" score
 * from — so "typing pattern" is scoped to the real behavioral signal
 * this app already has: the timing and content of a person's own sent
 * messages across all their conversations (`createdAt` timestamps
 * already stored on every `ChatMessage`). Distinct from #107's
 * fakeProfileDetector.ts, which is a static per-profile signal (report
 * count + a spammy bio) — this looks at ongoing chat *behavior* instead.
 * Two real, explainable checks: whether replies come in inhumanly fast
 * and inhumanly uniformly spaced (a scripted send-on-timer pattern), and
 * whether the exact same non-trivial text gets broadcast verbatim to
 * several different conversations (a scripted outreach pattern).
 */
export function analyzeTypingPattern(messages: TypingPatternMessage[]): TypingPatternAnalysis {
  const messageCount = messages.length;
  const hasEnoughData = messageCount >= MIN_MESSAGES_FOR_ANALYSIS;
  if (!hasEnoughData) {
    return { messageCount, hasEnoughData, flagged: false, reasons: [] };
  }

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(new Date(sorted[i].createdAt).getTime() - new Date(sorted[i - 1].createdAt).getTime());
  }

  const reasons: BotDetectionReason[] = [];

  if (intervals.length >= MIN_INTERVALS_FOR_TIMING_CHECKS) {
    const fastCount = intervals.filter((interval) => interval < MIN_HUMAN_INTERVAL_MS).length;
    if (fastCount / intervals.length >= FAST_REPLY_FLAG_RATIO) {
      reasons.push("impossibly_fast_replies");
    }

    const mean = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
    if (mean > 0) {
      const cv = standardDeviation(intervals) / mean;
      if (cv < MAX_HUMAN_LIKE_CV) {
        reasons.push("uniform_timing");
      }
    }
  }

  const roomsByText = new Map<string, Set<string>>();
  for (const message of messages) {
    if (message.text.length < MIN_DUPLICATE_TEXT_LENGTH) continue;
    const rooms = roomsByText.get(message.text) ?? new Set<string>();
    rooms.add(message.roomId);
    roomsByText.set(message.text, rooms);
  }
  const hasBroadcastText = [...roomsByText.values()].some((rooms) => rooms.size >= DUPLICATE_ROOM_THRESHOLD);
  if (hasBroadcastText) {
    reasons.push("duplicate_broadcast_text");
  }

  return { messageCount, hasEnoughData, flagged: reasons.length > 0, reasons };
}
