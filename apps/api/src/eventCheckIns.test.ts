import test from "node:test";
import assert from "node:assert/strict";
import { EventCheckInStore } from "./eventCheckIns";

test("issueTicket() rejects a missing eventId, host, or attendee", async () => {
  const store = new EventCheckInStore();
  assert.equal((await store.issueTicket("", "host", "alice")).success, false);
  assert.equal((await store.issueTicket("event-1", "", "alice")).success, false);
  assert.equal((await store.issueTicket("event-1", "host", "")).success, false);
});

test("issueTicket() succeeds and returns a real QR code data URL", async () => {
  const store = new EventCheckInStore();
  const result = await store.issueTicket("event-1", "host", "alice");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.ticket.eventId, "event-1");
  assert.equal(result.ticket.checkedInAt, null);
  assert.ok(result.qrCodeDataUrl.startsWith("data:image/"));
});

test("issueTicket() is idempotent per (eventId, attendee) — reissuing returns the same ticket/token", async () => {
  const store = new EventCheckInStore();
  const first = await store.issueTicket("event-1", "host", "alice");
  const second = await store.issueTicket("event-1", "host", "alice");
  if (!first.success || !second.success) return;
  assert.equal(first.ticket.token, second.ticket.token);
});

test("getTicket() and listTickets() reflect issued tickets", async () => {
  const store = new EventCheckInStore();
  await store.issueTicket("event-1", "host", "alice");
  await store.issueTicket("event-1", "host", "bob");
  await store.issueTicket("event-2", "host", "carol");

  assert.equal(store.getTicket("event-1", "alice")?.attendee, "alice");
  assert.equal(store.getTicket("event-1", "nobody"), undefined);
  assert.equal(store.listTickets("event-1").length, 2);
  assert.equal(store.listTickets("event-2").length, 1);
});

test("confirmCheckIn() requires the issuing host and rejects an unknown token", async () => {
  const store = new EventCheckInStore();
  const issued = await store.issueTicket("event-1", "host", "alice");
  if (!issued.success) return;

  assert.equal(store.confirmCheckIn("someone-else", issued.ticket.token).success, false);
  assert.equal(store.confirmCheckIn("host", "not-a-real-token").success, false);

  const result = store.confirmCheckIn("host", issued.ticket.token);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.ok(result.ticket.checkedInAt);
});

test("confirmCheckIn() rejects a ticket that's already been checked in", async () => {
  const store = new EventCheckInStore();
  const issued = await store.issueTicket("event-1", "host", "alice");
  if (!issued.success) return;

  store.confirmCheckIn("host", issued.ticket.token);
  const second = store.confirmCheckIn("host", issued.ticket.token);
  assert.equal(second.success, false);
});
