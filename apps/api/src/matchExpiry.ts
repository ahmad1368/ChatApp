// Bumble's real 24-hour "say something before the match expires" window.
export const MATCH_RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface MatchExpiryState {
  matchedAt: string;
  firstMessageSentAt?: string;
}

/**
 * Bumble's real "24-hour timer to respond to the first message before the
 * Match expires" (#136), building on #135's first-message rule: once
 * matched, if nobody sends the first message within 24 hours, the match
 * expires. Keyed by the unordered pair (order-independent — "A matched
 * with B" is a single fact, not two), so this deliberately doesn't care
 * which side was supposed to message first (#135's firstMessageRule.ts
 * already enforces that separately); it only tracks *whether* a message
 * was sent at all before the deadline.
 */
export class MatchExpiryStore {
  private statesByPairKey = new Map<string, MatchExpiryState>();

  private pairKey(a: string, b: string): string {
    return [a, b].sort().join("::");
  }

  /** No-op if this pair is already tracked — a match is recorded once, at the moment it first happens. */
  recordMatch(a: string, b: string, now: number = Date.now()): void {
    const key = this.pairKey(a, b);
    if (!this.statesByPairKey.has(key)) {
      this.statesByPairKey.set(key, { matchedAt: new Date(now).toISOString() });
    }
  }

  /** No-op if a first message was already recorded, or if this pair was never matched. */
  recordFirstMessage(a: string, b: string, now: number = Date.now()): void {
    const state = this.statesByPairKey.get(this.pairKey(a, b));
    if (state && !state.firstMessageSentAt) {
      state.firstMessageSentAt = new Date(now).toISOString();
    }
  }

  getState(a: string, b: string): MatchExpiryState | undefined {
    return this.statesByPairKey.get(this.pairKey(a, b));
  }

  /** A pair never tracked here (matched before this feature existed) never expires. */
  isExpired(a: string, b: string, now: number = Date.now()): boolean {
    const state = this.statesByPairKey.get(this.pairKey(a, b));
    if (!state || state.firstMessageSentAt) return false;
    return now - new Date(state.matchedAt).getTime() > MATCH_RESPONSE_WINDOW_MS;
  }
}
