export interface MatchTimer {
  matchedAt: string;
  timeTogetherMs: number;
}

/**
 * Tinder's real "Show a timer for time spent together after matching"
 * (#259) — an ascending "how long have we been matched" duration, the
 * opposite framing of #136/#137's descending "time left to say something"
 * countdown. Deliberately its own store rather than reusing
 * MatchExpiryStore's `matchedAt`: #137's extend() shifts that field
 * forward by a full 24h window, which is correct for measuring a
 * response deadline but would understate real elapsed time here — this
 * store records the one true, never-mutated moment a pair first matched.
 */
export class MatchTimerStore {
  private matchedAtByPairKey = new Map<string, string>();

  private pairKey(a: string, b: string): string {
    return [a, b].sort().join("::");
  }

  /** No-op if this pair is already tracked — a match happens once. */
  recordMatch(a: string, b: string, now: number = Date.now()): void {
    const key = this.pairKey(a, b);
    if (!this.matchedAtByPairKey.has(key)) {
      this.matchedAtByPairKey.set(key, new Date(now).toISOString());
    }
  }

  getTimer(a: string, b: string, now: number = Date.now()): MatchTimer | undefined {
    const matchedAt = this.matchedAtByPairKey.get(this.pairKey(a, b));
    if (!matchedAt) return undefined;
    return { matchedAt, timeTogetherMs: Math.max(0, now - new Date(matchedAt).getTime()) };
  }
}
