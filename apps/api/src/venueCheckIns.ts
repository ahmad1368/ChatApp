export interface VenueCheckIn {
  author: string;
  venue: string;
  checkedInAt: string;
  expiresAt: string;
}

export interface VenueSummary {
  venue: string;
  checkedInCount: number;
}

export type CheckInResult = { success: true; checkIn: VenueCheckIn } | { success: false; error: string };
export type CheckOutResult = { success: true } | { success: false; error: string };

// "See who's there" only means something for a few hours — long enough to
// cover an evening out, short enough that a forgotten check-in doesn't
// silently claim someone is still at a cafe the next morning. No client
// polling/beacon exists to detect someone actually leaving, so this
// expiry is the only signal that ends a check-in short of an explicit
// checkOut().
export const CHECKIN_DURATION_MS = 3 * 60 * 60 * 1000;

/**
 * Match.com's real "Check-in at public places and see who's there" (#224):
 * an explicit, named-venue check-in (distinct from #108's CrossedPathsStore,
 * which is raw GPS-coordinate proximity never shown as a place) that
 * surfaces who else is currently checked in at the same place. Checking in
 * somewhere new automatically checks you out of wherever you were before —
 * a person is only ever "at" one place at a time — and a check-in expires
 * on its own after CHECKIN_DURATION_MS even without an explicit checkOut().
 */
export class VenueCheckInStore {
  private checkInByAuthor = new Map<string, VenueCheckIn>();

  private isActive(checkIn: VenueCheckIn | undefined, now: number): checkIn is VenueCheckIn {
    return !!checkIn && new Date(checkIn.expiresAt).getTime() > now;
  }

  checkIn(author: unknown, venue: unknown, now: number = Date.now()): CheckInResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };

    const venueName = typeof venue === "string" ? venue.trim() : "";
    if (!venueName) return { success: false, error: "venue is required" };

    const checkIn: VenueCheckIn = {
      author: authorName,
      venue: venueName,
      checkedInAt: new Date(now).toISOString(),
      expiresAt: new Date(now + CHECKIN_DURATION_MS).toISOString(),
    };
    this.checkInByAuthor.set(authorName, checkIn);
    return { success: true, checkIn };
  }

  checkOut(author: unknown, now: number = Date.now()): CheckOutResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const existing = this.checkInByAuthor.get(authorName);
    if (!this.isActive(existing, now)) return { success: false, error: "You're not checked in anywhere" };

    this.checkInByAuthor.delete(authorName);
    return { success: true };
  }

  getMyCheckIn(author: unknown, now: number = Date.now()): VenueCheckIn | undefined {
    const authorName = typeof author === "string" ? author.trim() : "";
    const existing = this.checkInByAuthor.get(authorName);
    return this.isActive(existing, now) ? existing : undefined;
  }

  /** Everyone currently checked in at `venue`, most recent first. */
  getVenueCheckIns(venue: string, now: number = Date.now()): VenueCheckIn[] {
    return [...this.checkInByAuthor.values()]
      .filter((checkIn) => checkIn.venue === venue && this.isActive(checkIn, now))
      .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());
  }

  /** Venues with at least one active check-in right now, busiest first. */
  listActiveVenues(now: number = Date.now()): VenueSummary[] {
    const countByVenue = new Map<string, number>();
    for (const checkIn of this.checkInByAuthor.values()) {
      if (!this.isActive(checkIn, now)) continue;
      countByVenue.set(checkIn.venue, (countByVenue.get(checkIn.venue) ?? 0) + 1);
    }
    return [...countByVenue.entries()]
      .map(([venue, checkedInCount]) => ({ venue, checkedInCount }))
      .sort((a, b) => b.checkedInCount - a.checkedInCount);
  }
}
