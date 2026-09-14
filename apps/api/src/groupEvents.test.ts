import test from "node:test";
import assert from "node:assert/strict";
import { GroupEventStore } from "./groupEvents";

const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function createEvent(store: GroupEventStore, overrides: Partial<{ title: string; type: string; startsAt: string; capacity: number }> = {}) {
  return store.create("host", {
    title: "Trivia Night",
    description: "A fun game night",
    type: "game",
    startsAt: futureDate,
    capacity: 2,
    ...overrides,
  });
}

test("create() rejects a missing host, title, invalid type, invalid date, or invalid capacity", () => {
  const store = new GroupEventStore();
  assert.equal(store.create("", { title: "t", type: "game", startsAt: futureDate, capacity: 1 }).success, false);
  assert.equal(createEvent(store, { title: "" }).success, false);
  assert.equal(createEvent(store, { type: "not-a-real-type" }).success, false);
  assert.equal(createEvent(store, { startsAt: "not-a-date" }).success, false);
  assert.equal(createEvent(store, { capacity: 0 }).success, false);
});

test("create() succeeds with valid data", () => {
  const store = new GroupEventStore();
  const result = createEvent(store);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.event.host, "host");
  assert.equal(result.event.capacity, 2);
});

test("rsvp() confirms attendees up to capacity, then waitlists", () => {
  const store = new GroupEventStore();
  const created = createEvent(store, { capacity: 1 });
  if (!created.success) return;
  const eventId = created.event.id;

  const first = store.rsvp("alice", eventId);
  assert.equal(first.success, true);
  if (first.success) assert.equal(first.status, "confirmed");

  const second = store.rsvp("bob", eventId);
  assert.equal(second.success, true);
  if (second.success) assert.equal(second.status, "waitlisted");
});

test("rsvp() rejects an unknown event, a missing author, and a duplicate RSVP", () => {
  const store = new GroupEventStore();
  const created = createEvent(store);
  if (!created.success) return;
  const eventId = created.event.id;

  assert.equal(store.rsvp("alice", "not-a-real-event").success, false);
  assert.equal(store.rsvp("", eventId).success, false);
  store.rsvp("alice", eventId);
  assert.equal(store.rsvp("alice", eventId).success, false);
});

test("cancelRsvp() frees a confirmed spot and promotes the next waitlisted author", () => {
  const store = new GroupEventStore();
  const created = createEvent(store, { capacity: 1 });
  if (!created.success) return;
  const eventId = created.event.id;

  store.rsvp("alice", eventId);
  store.rsvp("bob", eventId);
  const cancel = store.cancelRsvp("alice", eventId);
  assert.equal(cancel.success, true);

  const details = store.getEvent(eventId)!;
  assert.deepEqual(details.confirmedAttendees, ["bob"]);
  assert.deepEqual(details.waitlist, []);
});

test("cancelRsvp() removes a waitlisted author without promoting anyone else", () => {
  const store = new GroupEventStore();
  const created = createEvent(store, { capacity: 1 });
  if (!created.success) return;
  const eventId = created.event.id;

  store.rsvp("alice", eventId);
  store.rsvp("bob", eventId);
  store.cancelRsvp("bob", eventId);

  const details = store.getEvent(eventId)!;
  assert.deepEqual(details.confirmedAttendees, ["alice"]);
  assert.deepEqual(details.waitlist, []);
});

test("cancelRsvp() rejects an unknown event and an author who never RSVP'd", () => {
  const store = new GroupEventStore();
  const created = createEvent(store);
  if (!created.success) return;
  assert.equal(store.cancelRsvp("alice", "not-a-real-event").success, false);
  assert.equal(store.cancelRsvp("alice", created.event.id).success, false);
});

test("getEvent() reports spotsRemaining correctly", () => {
  const store = new GroupEventStore();
  const created = createEvent(store, { capacity: 3 });
  if (!created.success) return;
  const eventId = created.event.id;
  store.rsvp("alice", eventId);
  const details = store.getEvent(eventId)!;
  assert.equal(details.spotsRemaining, 2);
});

test("getUpcoming() returns only events that haven't started yet, soonest first", () => {
  const store = new GroupEventStore();
  const soon = new Date(Date.now() + 60_000).toISOString();
  const later = new Date(Date.now() + 120_000).toISOString();
  createEvent(store, { startsAt: later, title: "Later" });
  createEvent(store, { startsAt: soon, title: "Soon" });
  const upcoming = store.getUpcoming();
  assert.equal(upcoming.length, 2);
  assert.equal(upcoming[0].startsAt, soon);
});
