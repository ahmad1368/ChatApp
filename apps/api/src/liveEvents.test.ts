import { test } from "node:test";
import assert from "node:assert/strict";
import { LiveEventStore } from "./liveEvents";

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();

test("create() rejects a missing createdBy", () => {
  const store = new LiveEventStore();
  const result = store.create("", { title: "Speed dating night", startsAt: FUTURE });
  assert.equal(result.success, false);
});

test("create() rejects a missing title", () => {
  const store = new LiveEventStore();
  const result = store.create("alice", { startsAt: FUTURE });
  assert.equal(result.success, false);
});

test("create() rejects a missing or invalid startsAt", () => {
  const store = new LiveEventStore();
  const result = store.create("alice", { title: "Speed dating night", startsAt: "not-a-date" });
  assert.equal(result.success, false);
});

test("create() succeeds with a valid title and startsAt", () => {
  const store = new LiveEventStore();
  const result = store.create("alice", { title: "Speed dating night", description: "Meet 10 people", startsAt: FUTURE });
  assert.equal(result.success, true);
  assert.equal(result.success && result.event.title, "Speed dating night");
  assert.equal(result.success && result.event.createdBy, "alice");
});

test("getUpcoming() lists an event whose start time is in the future", () => {
  const store = new LiveEventStore();
  store.create("alice", { title: "Speed dating night", startsAt: FUTURE });
  assert.equal(store.getUpcoming().length, 1);
});

test("getUpcoming() excludes an event whose start time has already passed", () => {
  const store = new LiveEventStore();
  const past = new Date(Date.now() - 1000).toISOString();
  store.create("alice", { title: "Already started", startsAt: past });
  assert.equal(store.getUpcoming().length, 0);
});

test("getUpcoming() sorts soonest first", () => {
  const store = new LiveEventStore();
  const soon = new Date(Date.now() + 60 * 1000).toISOString();
  const later = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  store.create("alice", { title: "Later event", startsAt: later });
  store.create("alice", { title: "Soon event", startsAt: soon });
  assert.deepEqual(
    store.getUpcoming().map((e) => e.title),
    ["Soon event", "Later event"]
  );
});

test("subscribe() rejects an unknown eventId", () => {
  const store = new LiveEventStore();
  const result = store.subscribe("alice", "nonexistent");
  assert.equal(result.success, false);
});

test("subscribe() then isSubscribed() and getSubscribers() reflect it", () => {
  const store = new LiveEventStore();
  const created = store.create("alice", { title: "Speed dating night", startsAt: FUTURE });
  const eventId = created.success ? created.event.id : "";
  store.subscribe("bob", eventId);
  assert.equal(store.isSubscribed("bob", eventId), true);
  assert.deepEqual(store.getSubscribers(eventId), ["bob"]);
});

test("unsubscribe() removes a subscriber", () => {
  const store = new LiveEventStore();
  const created = store.create("alice", { title: "Speed dating night", startsAt: FUTURE });
  const eventId = created.success ? created.event.id : "";
  store.subscribe("bob", eventId);
  store.unsubscribe("bob", eventId);
  assert.equal(store.isSubscribed("bob", eventId), false);
});

test("getEventsNeedingStartNotification() is empty before the start time arrives", () => {
  const store = new LiveEventStore();
  store.create("alice", { title: "Speed dating night", startsAt: FUTURE });
  assert.equal(store.getEventsNeedingStartNotification().length, 0);
});

test("getEventsNeedingStartNotification() includes an event once its start time has passed", () => {
  const store = new LiveEventStore();
  const now = Date.now();
  const startsAt = new Date(now + 1000).toISOString();
  store.create("alice", { title: "Speed dating night", startsAt });
  assert.equal(store.getEventsNeedingStartNotification(now + 2000).length, 1);
});

test("markStartNotificationSent() excludes the event from future needing-notification checks", () => {
  const store = new LiveEventStore();
  const now = Date.now();
  const startsAt = new Date(now + 1000).toISOString();
  const created = store.create("alice", { title: "Speed dating night", startsAt });
  const eventId = created.success ? created.event.id : "";
  store.markStartNotificationSent(eventId, now + 2000);
  assert.equal(store.getEventsNeedingStartNotification(now + 3000).length, 0);
});
