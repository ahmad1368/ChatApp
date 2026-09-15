import test from "node:test";
import assert from "node:assert/strict";
import { LocalSinglesEventStore } from "./localSinglesEvents";

const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function createEvent(
  store: LocalSinglesEventStore,
  overrides: Partial<{ title: string; city: string; venue: string; startsAt: string; capacity: number }> = {}
) {
  return store.create({
    title: "Singles Mixer",
    description: "Meet other local singles",
    city: "Austin",
    venue: "The Rooftop Bar",
    startsAt: futureDate,
    capacity: 2,
    ...overrides,
  });
}

test("create() rejects missing title, city, venue, invalid date, or invalid capacity", () => {
  const store = new LocalSinglesEventStore();
  assert.equal(createEvent(store, { title: "" }).success, false);
  assert.equal(createEvent(store, { city: "" }).success, false);
  assert.equal(createEvent(store, { venue: "" }).success, false);
  assert.equal(createEvent(store, { startsAt: "not-a-date" }).success, false);
  assert.equal(createEvent(store, { capacity: 0 }).success, false);
});

test("create() succeeds with valid data", () => {
  const store = new LocalSinglesEventStore();
  const result = createEvent(store);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.event.city, "Austin");
  assert.equal(result.event.capacity, 2);
});

test("listEvents() only returns upcoming events, soonest first", () => {
  const store = new LocalSinglesEventStore();
  const soon = new Date(Date.now() + 60_000).toISOString();
  const later = new Date(Date.now() + 120_000).toISOString();
  createEvent(store, { startsAt: later, title: "Later" });
  createEvent(store, { startsAt: soon, title: "Soon" });

  const events = store.listEvents();
  assert.equal(events.length, 2);
  assert.equal(events[0].title, "Soon");
});

test("listEvents() filters by city case-insensitively", () => {
  const store = new LocalSinglesEventStore();
  createEvent(store, { city: "Austin" });
  createEvent(store, { city: "Denver" });

  const austinEvents = store.listEvents({ city: "austin" });
  assert.equal(austinEvents.length, 1);
  assert.equal(austinEvents[0].city, "Austin");
});

test("listEvents() filters by calendar month (YYYY-MM)", () => {
  const store = new LocalSinglesEventStore();
  const thisMonth = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const nextMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 15);
  createEvent(store, { startsAt: thisMonth.toISOString(), title: "This Month" });
  createEvent(store, { startsAt: nextMonth.toISOString(), title: "Next Month" });

  const monthKey = thisMonth.toISOString().slice(0, 7);
  const filtered = store.listEvents({ month: monthKey });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, "This Month");
});

test("listCities() returns distinct cities with upcoming events, sorted", () => {
  const store = new LocalSinglesEventStore();
  createEvent(store, { city: "Denver" });
  createEvent(store, { city: "Austin" });
  createEvent(store, { city: "Austin" });

  assert.deepEqual(store.listCities(), ["Austin", "Denver"]);
});

test("rsvp() confirms attendees up to capacity, then waitlists, and cancelRsvp() promotes from the waitlist", () => {
  const store = new LocalSinglesEventStore();
  const created = createEvent(store, { capacity: 1 });
  if (!created.success) return;
  const eventId = created.event.id;

  const first = store.rsvp("alice", eventId);
  assert.equal(first.success, true);
  if (first.success) assert.equal(first.status, "confirmed");

  const second = store.rsvp("bob", eventId);
  assert.equal(second.success, true);
  if (second.success) assert.equal(second.status, "waitlisted");

  store.cancelRsvp("alice", eventId);
  const details = store.getEvent(eventId)!;
  assert.deepEqual(details.confirmedAttendees, ["bob"]);
  assert.deepEqual(details.waitlist, []);
});

test("rsvp() rejects an unknown event, a missing author, and a duplicate RSVP", () => {
  const store = new LocalSinglesEventStore();
  const created = createEvent(store);
  if (!created.success) return;
  const eventId = created.event.id;

  assert.equal(store.rsvp("alice", "not-a-real-event").success, false);
  assert.equal(store.rsvp("", eventId).success, false);
  store.rsvp("alice", eventId);
  assert.equal(store.rsvp("alice", eventId).success, false);
});

test("cancelRsvp() rejects an unknown event and an author who never RSVP'd", () => {
  const store = new LocalSinglesEventStore();
  const created = createEvent(store);
  if (!created.success) return;
  assert.equal(store.cancelRsvp("alice", "not-a-real-event").success, false);
  assert.equal(store.cancelRsvp("alice", created.event.id).success, false);
});

test("getEvent() reports spotsRemaining correctly and returns undefined for an unknown event", () => {
  const store = new LocalSinglesEventStore();
  const created = createEvent(store, { capacity: 3 });
  if (!created.success) return;
  const eventId = created.event.id;
  store.rsvp("alice", eventId);
  assert.equal(store.getEvent(eventId)!.spotsRemaining, 2);
  assert.equal(store.getEvent("not-a-real-event"), undefined);
});
