export interface SpinSegment {
  coins: number;
  weight: number;
}

/**
 * Coffee Meets Bagel's real "Daily Spin wheel to earn free coins" (#211)
 * — a real weighted-random prize wheel, one spin per UTC day per author,
 * paid out through #196's CoinStore.credit() (the same "store validates,
 * caller applies the effect" split #208/#210 already use for spending
 * coins). The fixed segment catalog below is what the client renders as
 * wheel wedges — small, common payouts and a rare jackpot, matching a
 * real spin-wheel's odds rather than a flat random amount.
 */
export const DAILY_SPIN_SEGMENTS: SpinSegment[] = [
  { coins: 5, weight: 35 },
  { coins: 10, weight: 25 },
  { coins: 20, weight: 20 },
  { coins: 50, weight: 12 },
  { coins: 100, weight: 6 },
  { coins: 500, weight: 2 },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextSpinAt(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

function pickPrize(random: () => number): SpinSegment {
  const totalWeight = DAILY_SPIN_SEGMENTS.reduce((sum, segment) => sum + segment.weight, 0);
  let roll = random() * totalWeight;
  for (const segment of DAILY_SPIN_SEGMENTS) {
    if (roll < segment.weight) return segment;
    roll -= segment.weight;
  }
  return DAILY_SPIN_SEGMENTS[DAILY_SPIN_SEGMENTS.length - 1];
}

export interface DailySpinStatus {
  canSpin: boolean;
  segments: SpinSegment[];
  nextSpinAt: string | null;
}

export type SpinResult = { success: true; coinsWon: number; nextSpinAt: string } | { success: false; error: string };

export class DailySpinStore {
  private lastSpinDateByAuthor = new Map<string, string>();

  private canSpin(author: string): boolean {
    return this.lastSpinDateByAuthor.get(author) !== todayKey();
  }

  getStatus(author: unknown): DailySpinStatus {
    const authorText = typeof author === "string" ? author.trim() : "";
    const canSpin = authorText ? this.canSpin(authorText) : false;
    return { canSpin, segments: DAILY_SPIN_SEGMENTS, nextSpinAt: canSpin ? null : nextSpinAt() };
  }

  spin(author: unknown, random: () => number = Math.random): SpinResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (!this.canSpin(authorText)) {
      return { success: false, error: "You've already spun today — come back tomorrow" };
    }

    const prize = pickPrize(random);
    this.lastSpinDateByAuthor.set(authorText, todayKey());
    return { success: true, coinsWon: prize.coins, nextSpinAt: nextSpinAt() };
  }
}
