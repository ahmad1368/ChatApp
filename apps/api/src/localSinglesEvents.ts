import { randomUUID } from "crypto";

export interface LocalSinglesEvent {
  id: string;
  title: string;
  description: string;
  city: string;
  venue: string;
  startsAt: string;
  capacity: number;
}

export interface LocalSinglesEventDetails extends LocalSinglesEvent {
  confirmedAttendees: string[];
  waitlist: string[];
  spotsRemaining: number;
}

export type CreateLocalEventResult = { success: true; event: LocalSinglesEvent } | { success: false; error: string };
export type RsvpResult = { success: true; status: "confirmed" | "waitlisted" } | { success: false; error: string };
export type CancelRsvpResult = { success: true } | { success: false; error: string };

/**
 * Match.com's real "Local singles events calendar" (#227): a calendar of
 * official, admin-curated local singles mixers (gated by requireAdmin at
 * the route level, unlike #221/#222's GroupEventStore, which anyone can
 * host) that members browse by city and month rather than a flat list —
 * the real "calendar" half of the feature. A new store rather than
 * reusing GroupEventStore because the two differ on more than a field:
 * authorship (admin-curated vs. any member hosting) and the discovery
 * shape (city/month-filtered calendar vs. a plain upcoming list). It
 * reuses the same real capacity-limited RSVP-with-waitlist mechanic
 * #221/#222 already established, since that part genuinely doesn't
 * change: reaching capacity waitlists rather than rejecting, and
 * cancelling promotes the longest-waiting waitlisted attendee.
 */
export class LocalSinglesEventStore {
  private eventsById = new Map<string, LocalSinglesEvent>();
  private confirmedByEventId = new Map<string, string[]>();
  private waitlistByEventId = new Map<string, string[]>();

  create(
    payload:
      | { title?: unknown; description?: unknown; city?: unknown; venue?: unknown; startsAt?: unknown; capacity?: unknown }
      | undefined
  ): CreateLocalEventResult {
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    if (!title) return { success: false, error: "title is required" };

    const city = typeof payload?.city === "string" ? payload.city.trim() : "";
    if (!city) return { success: false, error: "city is required" };

    const venue = typeof payload?.venue === "string" ? payload.venue.trim() : "";
    if (!venue) return { success: false, error: "venue is required" };

    const startsAtRaw = typeof payload?.startsAt === "string" ? payload.startsAt : "";
    const startsAt = new Date(startsAtRaw);
    if (!startsAtRaw || Number.isNaN(startsAt.getTime())) return { success: false, error: "startsAt must be a valid date/time" };

    const capacity = payload?.capacity;
    if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1) {
      return { success: false, error: "capacity must be a positive integer" };
    }

    const description = typeof payload?.description === "string" ? payload.description.trim() : "";

    const event: LocalSinglesEvent = {
      id: randomUUID(),
      title,
      description,
      city,
      venue,
      startsAt: startsAt.toISOString(),
      capacity,
    };
    this.eventsById.set(event.id, event);
    this.confirmedByEventId.set(event.id, []);
    this.waitlistByEventId.set(event.id, []);
    return { success: true, event };
  }

  /** Upcoming events only, soonest first, optionally narrowed to a city and/or a calendar month ("YYYY-MM"). */
  listEvents(filter: { city?: string; month?: string } = {}, now: number = Date.now()): LocalSinglesEvent[] {
    return [...this.eventsById.values()]
      .filter((event) => new Date(event.startsAt).getTime() > now)
      .filter((event) => !filter.city || event.city.toLowerCase() === filter.city.toLowerCase())
      .filter((event) => !filter.month || event.startsAt.slice(0, 7) === filter.month)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  rsvp(author: unknown, eventId: string): RsvpResult {
    const event = this.eventsById.get(eventId);
    if (!event) return { success: false, error: "Event not found" };

    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };

    const confirmed = this.confirmedByEventId.get(eventId)!;
    const waitlist = this.waitlistByEventId.get(eventId)!;
    if (confirmed.includes(authorText) || waitlist.includes(authorText)) {
      return { success: false, error: "You've already RSVP'd to this event" };
    }

    if (confirmed.length < event.capacity) {
      confirmed.push(authorText);
      return { success: true, status: "confirmed" };
    }
    waitlist.push(authorText);
    return { success: true, status: "waitlisted" };
  }

  cancelRsvp(author: unknown, eventId: string): CancelRsvpResult {
    if (!this.eventsById.has(eventId)) return { success: false, error: "Event not found" };

    const authorText = typeof author === "string" ? author.trim() : "";
    const confirmed = this.confirmedByEventId.get(eventId)!;
    const waitlist = this.waitlistByEventId.get(eventId)!;

    const confirmedIndex = confirmed.indexOf(authorText);
    if (confirmedIndex !== -1) {
      confirmed.splice(confirmedIndex, 1);
      const promoted = waitlist.shift();
      if (promoted) confirmed.push(promoted);
      return { success: true };
    }

    const waitlistIndex = waitlist.indexOf(authorText);
    if (waitlistIndex !== -1) {
      waitlist.splice(waitlistIndex, 1);
      return { success: true };
    }
    return { success: false, error: "You haven't RSVP'd to this event" };
  }

  getEvent(eventId: string): LocalSinglesEventDetails | undefined {
    const event = this.eventsById.get(eventId);
    if (!event) return undefined;
    const confirmedAttendees = this.confirmedByEventId.get(eventId) ?? [];
    const waitlist = this.waitlistByEventId.get(eventId) ?? [];
    return { ...event, confirmedAttendees, waitlist, spotsRemaining: Math.max(0, event.capacity - confirmedAttendees.length) };
  }

  /** Distinct cities with at least one upcoming event, for a city filter dropdown. */
  listCities(now: number = Date.now()): string[] {
    const cities = new Set<string>();
    for (const event of this.eventsById.values()) {
      if (new Date(event.startsAt).getTime() > now) cities.add(event.city);
    }
    return [...cities].sort();
  }
}
