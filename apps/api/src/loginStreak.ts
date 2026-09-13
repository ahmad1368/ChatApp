export interface StreakReward {
  day: number;
  coins: number;
}

/**
 * Tinder's real "Reward for consecutive daily logins (Daily Streak)"
 * (#212) — a growing 7-day reward cycle (small day-to-day payouts and a
 * bigger day-7 jackpot) that repeats for a streak longer than a week,
 * paid out through #196's CoinStore.credit() the same way #211's daily
 * spin already earns coins outright.
 */
export const LOGIN_STREAK_REWARDS: StreakReward[] = [
  { day: 1, coins: 5 },
  { day: 2, coins: 10 },
  { day: 3, coins: 15 },
  { day: 4, coins: 20 },
  { day: 5, coins: 30 },
  { day: 6, coins: 40 },
  { day: 7, coins: 100 },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

function rewardForStreak(streak: number): number {
  return LOGIN_STREAK_REWARDS[(streak - 1) % LOGIN_STREAK_REWARDS.length].coins;
}

export interface LoginStreakStatus {
  streak: number;
  lastCheckInDate: string | null;
  rewards: StreakReward[];
}

export interface CheckIn {
  streak: number;
  coinsAwarded: number;
  alreadyCheckedInToday: boolean;
}

export type CheckInResult = { success: true; checkIn: CheckIn } | { success: false; error: string };

/**
 * Idempotent per calendar day (UTC): calling check-in more than once the
 * same day returns the already-recorded streak with coinsAwarded: 0
 * rather than double-paying — the client can safely call this on every
 * page load instead of tracking "have I already checked in" itself.
 * Missing a day resets the streak to 1 rather than merely pausing it.
 */
export class LoginStreakStore {
  private streakByAuthor = new Map<string, number>();
  private lastCheckInDateByAuthor = new Map<string, string>();

  getStatus(author: unknown): LoginStreakStatus {
    const authorText = typeof author === "string" ? author.trim() : "";
    return {
      streak: authorText ? this.streakByAuthor.get(authorText) ?? 0 : 0,
      lastCheckInDate: authorText ? this.lastCheckInDateByAuthor.get(authorText) ?? null : null,
      rewards: LOGIN_STREAK_REWARDS,
    };
  }

  checkIn(author: unknown): CheckInResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };

    const today = todayKey();
    const lastCheckIn = this.lastCheckInDateByAuthor.get(authorText);
    if (lastCheckIn === today) {
      return { success: true, checkIn: { streak: this.streakByAuthor.get(authorText) ?? 1, coinsAwarded: 0, alreadyCheckedInToday: true } };
    }

    const continuesStreak = lastCheckIn === yesterdayKey();
    const streak = continuesStreak ? (this.streakByAuthor.get(authorText) ?? 0) + 1 : 1;
    const coinsAwarded = rewardForStreak(streak);

    this.streakByAuthor.set(authorText, streak);
    this.lastCheckInDateByAuthor.set(authorText, today);

    return { success: true, checkIn: { streak, coinsAwarded, alreadyCheckedInToday: false } };
  }
}
