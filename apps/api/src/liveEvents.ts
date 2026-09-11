import { randomUUID } from "crypto";

export interface LiveEvent {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  createdBy: string;
  startNotificationSentAt?: string;
}

export type CreateLiveEventResult = { success: true; event: LiveEvent } | { success: false; error: string };
export type SubscribeResult = { success: true; subscribed: boolean } | { success: false; error: string };

/**
 * Match.com's real "in-app live events" (#155, e.g. a live speed-dating
 * night or Q&A) — no admin role exists in this app (same scoping call as
 * #109's squads/#110's double dates letting any author organize a group
 * activity), so any author can schedule one. Users opt in with
 * subscribe(); a periodic sweep (see server.ts, same "poll a store"
 * shape as #154's match-expiry reminder) fires the "it's starting" push
 * to every subscriber once `startsAt` arrives, exactly once per event.
 */
export class LiveEventStore {
  private eventsById = new Map<string, LiveEvent>();
  private subscribersByEventId = new Map<string, Set<string>>();

  create(createdBy: unknown, payload: { title?: unknown; description?: unknown; startsAt?: unknown } | undefined): CreateLiveEventResult {
    const createdByName = typeof createdBy === "string" ? createdBy.trim() : "";
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const description = typeof payload?.description === "string" ? payload.description.trim() : "";
    const startsAtRaw = typeof payload?.startsAt === "string" ? payload.startsAt : "";

    if (!createdByName) return { success: false, error: "createdBy is required" };
    if (!title) return { success: false, error: "title is required" };

    const startsAt = new Date(startsAtRaw);
    if (!startsAtRaw || Number.isNaN(startsAt.getTime())) {
      return { success: false, error: "startsAt must be a valid date/time" };
    }

    const event: LiveEvent = {
      id: randomUUID(),
      title,
      description,
      startsAt: startsAt.toISOString(),
      createdBy: createdByName,
    };
    this.eventsById.set(event.id, event);
    return { success: true, event };
  }

  /** Events that haven't started yet, soonest first. */
  getUpcoming(now: number = Date.now()): LiveEvent[] {
    return [...this.eventsById.values()]
      .filter((event) => new Date(event.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  subscribe(author: unknown, eventId: string): SubscribeResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };
    if (!this.eventsById.has(eventId)) return { success: false, error: "Event not found" };

    const subscribers = this.subscribersByEventId.get(eventId) ?? new Set<string>();
    subscribers.add(authorName);
    this.subscribersByEventId.set(eventId, subscribers);
    return { success: true, subscribed: true };
  }

  unsubscribe(author: unknown, eventId: string): SubscribeResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };
    this.subscribersByEventId.get(eventId)?.delete(authorName);
    return { success: true, subscribed: false };
  }

  isSubscribed(author: string, eventId: string): boolean {
    return this.subscribersByEventId.get(eventId)?.has(author) ?? false;
  }

  getSubscribers(eventId: string): string[] {
    return [...(this.subscribersByEventId.get(eventId) ?? [])];
  }

  /** Every event whose start time has arrived but whose subscribers haven't been notified yet. */
  getEventsNeedingStartNotification(now: number = Date.now()): LiveEvent[] {
    return [...this.eventsById.values()].filter(
      (event) => !event.startNotificationSentAt && new Date(event.startsAt).getTime() <= now
    );
  }

  markStartNotificationSent(eventId: string, now: number = Date.now()): void {
    const event = this.eventsById.get(eventId);
    if (event) {
      event.startNotificationSentAt = new Date(now).toISOString();
    }
  }
}
