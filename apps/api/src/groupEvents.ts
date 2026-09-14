import { randomUUID } from "crypto";

export const GROUP_EVENT_TYPES = ["webinar", "game", "cafe", "outdoor"] as const;
export type GroupEventType = (typeof GROUP_EVENT_TYPES)[number];

/** #221's online types have no physical venue; #222's real-world group dates require one. */
const IN_PERSON_TYPES: readonly GroupEventType[] = ["cafe", "outdoor"];

export interface GroupEvent {
  id: string;
  host: string;
  title: string;
  description: string;
  type: GroupEventType;
  startsAt: string;
  capacity: number;
  location?: string;
}

export interface GroupEventDetails extends GroupEvent {
  confirmedAttendees: string[];
  waitlist: string[];
  spotsRemaining: number;
}

export type CreateGroupEventResult = { success: true; event: GroupEvent } | { success: false; error: string };
export type RsvpResult = { success: true; status: "confirmed" | "waitlisted" } | { success: false; error: string };
export type CancelRsvpResult = { success: true } | { success: false; error: string };

function isGroupEventType(value: unknown): value is GroupEventType {
  return typeof value === "string" && (GROUP_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * Match.com's real "Create online group events (webinars, games)"
 * (#221) and "Create real group dates at cafes or in nature" (#222) —
 * distinct from #155's LiveEventStore, which is a lightweight,
 * capacity-free "opt in to be notified when this starts" subscription:
 * this is a real capacity-limited RSVP with a waitlist, the actual
 * "RSVP/capacity" half of both issues' shared implementation guide (the
 * other half, QR check-in, is #230's separate scope — not duplicated
 * here). #222 reuses this exact RSVP/capacity/waitlist engine rather
 * than a parallel one — the only real difference between an online
 * webinar/game and an in-person cafe/outdoor date is a physical
 * location, not a different sign-up mechanic — and adds a required
 * `location` field for its two in-person types. Reaching capacity
 * waitlists rather than rejecting, and a cancellation automatically
 * promotes the longest-waiting waitlisted author, the same "real event
 * logistics" any of these four event kinds actually needs.
 */
export class GroupEventStore {
  private eventsById = new Map<string, GroupEvent>();
  private confirmedByEventId = new Map<string, string[]>();
  private waitlistByEventId = new Map<string, string[]>();

  create(
    host: unknown,
    payload: { title?: unknown; description?: unknown; type?: unknown; startsAt?: unknown; capacity?: unknown; location?: unknown } | undefined
  ): CreateGroupEventResult {
    const hostName = typeof host === "string" ? host.trim() : "";
    if (!hostName) return { success: false, error: "host is required" };

    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    if (!title) return { success: false, error: "title is required" };

    if (!isGroupEventType(payload?.type)) return { success: false, error: `type must be one of: ${GROUP_EVENT_TYPES.join(", ")}` };
    const type = payload!.type as GroupEventType;

    const location = typeof payload?.location === "string" ? payload.location.trim() : "";
    if (IN_PERSON_TYPES.includes(type) && !location) {
      return { success: false, error: "location is required for a cafe or outdoor group date" };
    }

    const startsAtRaw = typeof payload?.startsAt === "string" ? payload.startsAt : "";
    const startsAt = new Date(startsAtRaw);
    if (!startsAtRaw || Number.isNaN(startsAt.getTime())) return { success: false, error: "startsAt must be a valid date/time" };

    const capacity = payload?.capacity;
    if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1) {
      return { success: false, error: "capacity must be a positive integer" };
    }

    const description = typeof payload?.description === "string" ? payload.description.trim() : "";

    const event: GroupEvent = {
      id: randomUUID(),
      host: hostName,
      title,
      description,
      type,
      startsAt: startsAt.toISOString(),
      capacity,
      ...(location ? { location } : {}),
    };
    this.eventsById.set(event.id, event);
    this.confirmedByEventId.set(event.id, []);
    this.waitlistByEventId.set(event.id, []);
    return { success: true, event };
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

  getEvent(eventId: string): GroupEventDetails | undefined {
    const event = this.eventsById.get(eventId);
    if (!event) return undefined;
    const confirmedAttendees = this.confirmedByEventId.get(eventId) ?? [];
    const waitlist = this.waitlistByEventId.get(eventId) ?? [];
    return { ...event, confirmedAttendees, waitlist, spotsRemaining: Math.max(0, event.capacity - confirmedAttendees.length) };
  }

  /** Events that haven't started yet, soonest first — same shape as #155's LiveEventStore.getUpcoming(). */
  getUpcoming(now: number = Date.now()): GroupEvent[] {
    return [...this.eventsById.values()]
      .filter((event) => new Date(event.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }
}
