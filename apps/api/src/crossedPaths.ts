import { Coordinates, haversineDistanceKm } from "./locationPrivacy";

// "Crossed Paths" only means something over a real physical distance —
// this is closer to real Tinder's old feature (which used something in
// the low hundreds of meters) than the 5km grid #33/#102 use for
// on-profile location privacy, since this signal is never shown to the
// other person as a location at all, only as a yes/no "your paths crossed".
export const DEFAULT_CROSSED_PATHS_THRESHOLD_KM = 0.5;

// Pings older than this no longer count as "recently" crossing paths —
// same 24h window precedent as #104's profile visitors.
export const PING_WINDOW_MS = 24 * 60 * 60 * 1000;

// Caps unbounded growth for an author who updates location very often.
const MAX_PINGS_PER_AUTHOR = 200;

interface LocationPing {
  coordinates: Coordinates;
  recordedAt: number;
}

/**
 * Tinder's real (now-discontinued) "Crossed Paths" (#108): surfaces
 * candidates whose real-world location trail physically overlapped with
 * yours recently, not just people who happen to live in the same city.
 * This app has no continuous background GPS tracking (no native app, no
 * always-on geolocation service worker) — a "ping" is recorded each time
 * a client calls the existing PUT /api/users/:author/location (#33/#102),
 * so the trail's resolution is only as good as how often that endpoint is
 * called, an honest limitation rather than a fabricated live-tracking
 * claim. Exact coordinates never leave this module, same rule as
 * LocationStore — only a boolean "did these two people's recent pings
 * come within threshold of each other" is ever exposed.
 */
export class CrossedPathsStore {
  private pingsByAuthor = new Map<string, LocationPing[]>();

  recordPing(author: string, coordinates: Coordinates, now: number = Date.now()): void {
    const pings = this.pingsByAuthor.get(author) ?? [];
    pings.push({ coordinates, recordedAt: now });
    if (pings.length > MAX_PINGS_PER_AUTHOR) {
      pings.splice(0, pings.length - MAX_PINGS_PER_AUTHOR);
    }
    this.pingsByAuthor.set(author, pings);
  }

  private recentPings(author: string, now: number): LocationPing[] {
    const pings = this.pingsByAuthor.get(author) ?? [];
    const cutoff = now - PING_WINDOW_MS;
    return pings.filter((ping) => ping.recordedAt >= cutoff);
  }

  haveCrossedPaths(
    a: string,
    b: string,
    thresholdKm: number = DEFAULT_CROSSED_PATHS_THRESHOLD_KM,
    now: number = Date.now()
  ): boolean {
    const pingsA = this.recentPings(a, now);
    if (pingsA.length === 0) return false;
    const pingsB = this.recentPings(b, now);
    if (pingsB.length === 0) return false;

    return pingsA.some((pingA) => pingsB.some((pingB) => haversineDistanceKm(pingA.coordinates, pingB.coordinates) <= thresholdKm));
  }

  /** Narrows a candidate pool to authors whose paths recently crossed with `author`. */
  getCrossedAuthors(
    author: string,
    candidatePool: string[],
    thresholdKm: number = DEFAULT_CROSSED_PATHS_THRESHOLD_KM,
    now: number = Date.now()
  ): string[] {
    return candidatePool.filter((candidate) => this.haveCrossedPaths(author, candidate, thresholdKm, now));
  }
}
