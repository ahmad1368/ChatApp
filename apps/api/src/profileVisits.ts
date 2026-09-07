export const VISITOR_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ProfileVisit {
  author: string;
  visitedAt: string;
}

/**
 * Tinder Gold's real "Who's Viewed You" (#104): tracks visits to
 * `GET /api/profile-preview/:author?viewer=<viewer>` (see server.ts) and
 * surfaces everyone who viewed this author's profile within the last 24
 * hours. Only the single most recent visit per visitor is kept — a
 * visitor list shows *who* looked, not a raw view-event log — and a
 * self-visit (viewing your own profile) is never recorded.
 *
 * Visits are pruned lazily on read rather than with a background timer:
 * this store has no process-lifetime concept of "now" ticking on its
 * own, so `getRecentVisitors` filters by the window every call instead.
 */
export class ProfileVisitsStore {
  private visitsByAuthor = new Map<string, Map<string, string>>();

  recordVisit(viewer: string, viewed: string, now: number = Date.now()): void {
    if (!viewer || !viewed || viewer === viewed) return;
    const visitors = this.visitsByAuthor.get(viewed) ?? new Map<string, string>();
    visitors.set(viewer, new Date(now).toISOString());
    this.visitsByAuthor.set(viewed, visitors);
  }

  getRecentVisitors(author: string, windowMs: number = VISITOR_WINDOW_MS, now: number = Date.now()): ProfileVisit[] {
    const visitors = this.visitsByAuthor.get(author);
    if (!visitors) return [];

    const cutoff = now - windowMs;
    const recent: ProfileVisit[] = [];
    for (const [visitor, visitedAt] of visitors) {
      if (new Date(visitedAt).getTime() >= cutoff) {
        recent.push({ author: visitor, visitedAt });
      }
    }
    return recent.sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));
  }
}
