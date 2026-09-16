import { Coordinates, haversineDistanceKm } from "./locationPrivacy";

// Generous enough to never false-positive on real international travel
// by commercial flight (~900 km/h cruise speed, plus margin) — any
// implied speed above this between two consecutive location updates can
// only mean a spoofed/faked location, not real human movement.
export const IMPLAUSIBLE_SPEED_KMH = 1000;

// Updates closer together than this aren't evaluated at all — dividing a
// real short hop by too small an elapsed time would produce a huge, noisy
// implied speed from perfectly ordinary GPS jitter.
const MIN_ELAPSED_HOURS_TO_EVALUATE = 1 / 60;

export interface LocationChangeCheck {
  suddenChange: boolean;
  distanceKm: number;
  impliedSpeedKmh: number | null;
}

/**
 * Bumble's real "Automatic alert on sudden change in geographic location"
 * (#273) — a real safety signal: two consecutive location updates from
 * the same author whose implied travel speed exceeds what's physically
 * possible for a real person (account compromise, location spoofing) get
 * flagged, the same "compute a real number, compare to a documented
 * threshold" honesty as #106's peak-hours histogram, not a fabricated
 * anomaly-detection model.
 */
export class LocationChangeAlertStore {
  private lastByAuthor = new Map<string, { coordinates: Coordinates; recordedAt: number }>();

  /** Call once per real location update. The very first update for an author is never "sudden" — there's nothing to compare it against. */
  recordAndCheck(author: string, coordinates: Coordinates, now: number = Date.now()): LocationChangeCheck {
    const previous = this.lastByAuthor.get(author);
    this.lastByAuthor.set(author, { coordinates, recordedAt: now });

    if (!previous) {
      return { suddenChange: false, distanceKm: 0, impliedSpeedKmh: null };
    }

    const distanceKm = haversineDistanceKm(previous.coordinates, coordinates);
    const elapsedHours = (now - previous.recordedAt) / (1000 * 60 * 60);
    if (elapsedHours < MIN_ELAPSED_HOURS_TO_EVALUATE) {
      return { suddenChange: false, distanceKm, impliedSpeedKmh: null };
    }

    const impliedSpeedKmh = distanceKm / elapsedHours;
    return { suddenChange: impliedSpeedKmh > IMPLAUSIBLE_SPEED_KMH, distanceKm, impliedSpeedKmh };
  }
}
