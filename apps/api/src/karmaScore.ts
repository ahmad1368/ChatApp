export const KARMA_STARTING_SCORE = 80;
export const KARMA_MIN_SCORE = 0;
export const KARMA_MAX_SCORE = 100;
export const KARMA_REPORT_PENALTY = 15;
export const KARMA_BLOCK_PENALTY = 5;
export const KARMA_MATCH_REWARD = 2;

/**
 * Tinder's real "Scoring system for positive behavior (Karma / Respect
 * Score)" (#218) — everyone starts in good standing at 80/100, with
 * room to move in both directions from real signals this app already
 * tracks: being reported (#41) or blocked (#42) docks points, landing a
 * mutual match rewards a small amount toward a perfect 100. Each
 * real-world event (a specific report id, a specific blocker/blocked
 * pair, a specific match pair) is only ever applied once — the
 * idempotent "state machine" the issue's implementation guide asks for
 * — so retrying a request or re-deriving the same match never
 * double-penalizes or double-rewards.
 */
export class KarmaScoreStore {
  private scoreByAuthor = new Map<string, number>();
  private appliedEventKeys = new Set<string>();

  getScore(author: string): number {
    return this.scoreByAuthor.get(author) ?? KARMA_STARTING_SCORE;
  }

  private applyOnce(eventKey: string, author: string, delta: number): void {
    if (this.appliedEventKeys.has(eventKey)) return;
    this.appliedEventKeys.add(eventKey);
    const next = Math.max(KARMA_MIN_SCORE, Math.min(KARMA_MAX_SCORE, this.getScore(author) + delta));
    this.scoreByAuthor.set(author, next);
  }

  recordReportReceived(reportedAuthor: unknown, reportId: unknown): void {
    const authorText = typeof reportedAuthor === "string" ? reportedAuthor.trim() : "";
    const idText = typeof reportId === "string" ? reportId : "";
    if (!authorText || !idText) return;
    this.applyOnce(`report:${idText}`, authorText, -KARMA_REPORT_PENALTY);
  }

  recordBlockReceived(blockedAuthor: unknown, blockerAuthor: unknown): void {
    const authorText = typeof blockedAuthor === "string" ? blockedAuthor.trim() : "";
    const blockerText = typeof blockerAuthor === "string" ? blockerAuthor.trim() : "";
    if (!authorText || !blockerText) return;
    this.applyOnce(`block:${blockerText}->${authorText}`, authorText, -KARMA_BLOCK_PENALTY);
  }

  recordMatch(authorA: unknown, authorB: unknown): void {
    const a = typeof authorA === "string" ? authorA.trim() : "";
    const b = typeof authorB === "string" ? authorB.trim() : "";
    if (!a || !b) return;
    const pairKey = [a, b].sort().join("|");
    this.applyOnce(`match:${pairKey}:${a}`, a, KARMA_MATCH_REWARD);
    this.applyOnce(`match:${pairKey}:${b}`, b, KARMA_MATCH_REWARD);
  }
}
