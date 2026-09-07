const HOURS_PER_DAY = 24;

export interface PeakHoursStatus {
  peakHours: number[];
  isPeakHourNow: boolean;
}

/**
 * The "smart" half of Tinder's real Super Boost (#106): real Tinder
 * recommends the best time to activate a boost based on when the most
 * people in the network are active, rather than leaving the user to
 * guess. This app has no historical event warehouse to mine, so it
 * approximates "network activity" with a running UTC-hour-of-day
 * histogram of swipe events (see server.ts's POST /api/swipes) — an
 * honest proxy for "when are people swiping", not a fabricated ML
 * recommendation. The histogram accumulates for the process lifetime
 * rather than resetting daily, since a fresh process has no history to
 * learn from otherwise.
 */
export class PeakHoursStore {
  private activityByHour = new Array<number>(HOURS_PER_DAY).fill(0);

  recordActivity(now: number = Date.now()): void {
    const hour = new Date(now).getUTCHours();
    this.activityByHour[hour] += 1;
  }

  /** Hours (0-23 UTC) with the most recorded activity, most active first. */
  getPeakHours(topN = 3): number[] {
    return this.activityByHour
      .map((count, hour) => ({ hour, count }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count || a.hour - b.hour)
      .slice(0, topN)
      .map((entry) => entry.hour);
  }

  getStatus(topN = 3, now: number = Date.now()): PeakHoursStatus {
    const peakHours = this.getPeakHours(topN);
    const currentHour = new Date(now).getUTCHours();
    return { peakHours, isPeakHourNow: peakHours.includes(currentHour) };
  }
}
