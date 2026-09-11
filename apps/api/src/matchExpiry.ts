// Bumble's real 24-hour "say something before the match expires" window.
export const MATCH_RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;

// Tinder's real practice of nudging users before a closing window shuts —
// a few hours' notice: early enough to actually leave time to act, late
// enough that it reads as "running out" rather than a premature nag.
export const MATCH_EXPIRY_REMINDER_LEAD_MS = 4 * 60 * 60 * 1000;

export interface MatchExpiryState {
  matchedAt: string;
  firstMessageSentAt?: string;
  extended?: boolean;
  // Tinder's real "Reminder notification to respond to expiring chats"
  // (#154) — set the first (and only) time a reminder fires for this
  // pair, same "state tracked so it only ever happens once" shape as
  // `extended` above.
  reminderSentAt?: string;
}

export interface ExtendMatchResult {
  allowed: boolean;
  error?: string;
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

  /**
   * Bumble's real "Extend" (#137) — either side can push the 24-hour
   * deadline back by another 24 hours, once per match, as long as nobody
   * has sent the first message yet and it hasn't already expired.
   * Implemented by shifting `matchedAt` forward by a full window, which
   * `isExpired` then measures from as usual.
   */
  extend(a: string, b: string, now: number = Date.now()): ExtendMatchResult {
    const state = this.statesByPairKey.get(this.pairKey(a, b));
    if (!state) {
      return { allowed: false, error: "No tracked match between these two authors" };
    }
    if (state.firstMessageSentAt) {
      return { allowed: false, error: "This match already has a conversation started" };
    }
    if (state.extended) {
      return { allowed: false, error: "This match has already been extended once" };
    }
    if (this.isExpired(a, b, now)) {
      return { allowed: false, error: "This match has already expired" };
    }
    state.extended = true;
    state.matchedAt = new Date(new Date(state.matchedAt).getTime() + MATCH_RESPONSE_WINDOW_MS).toISOString();
    return { allowed: true };
  }

  /**
   * Tinder's real "Reminder notification to respond to expiring chats"
   * (#154) — true once per match, in the lead-time window before #136's
   * 24-hour deadline, only while nobody's said anything yet and this
   * pair hasn't already been reminded. A periodic sweep (see server.ts)
   * calls this for every tracked pair rather than scheduling a one-off
   * timer per match, the same "poll a store" shape the rest of this app
   * uses instead of a job queue it has no infra for.
   */
  needsExpiryReminder(a: string, b: string, now: number = Date.now()): boolean {
    const state = this.statesByPairKey.get(this.pairKey(a, b));
    if (!state || state.firstMessageSentAt || state.reminderSentAt) return false;
    if (this.isExpired(a, b, now)) return false;
    const deadline = new Date(state.matchedAt).getTime() + MATCH_RESPONSE_WINDOW_MS;
    return deadline - now <= MATCH_EXPIRY_REMINDER_LEAD_MS;
  }

  markReminderSent(a: string, b: string, now: number = Date.now()): void {
    const state = this.statesByPairKey.get(this.pairKey(a, b));
    if (state) {
      state.reminderSentAt = new Date(now).toISOString();
    }
  }

  /** Every tracked pair, as [a, b] tuples, for a periodic sweep to check each for reminder eligibility. */
  getAllPairs(): [string, string][] {
    return [...this.statesByPairKey.keys()].map((key) => key.split("::") as [string, string]);
  }
}
