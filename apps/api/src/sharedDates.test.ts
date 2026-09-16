import { test } from "node:test";
import assert from "node:assert/strict";
import { SharedDateStore, NO_RESPONSE_ALERT_WINDOW_MS } from "./sharedDates";

const VALID_PAYLOAD = {
  meetingWith: "Jordan",
  location: "Blue Bottle Coffee",
  scheduledAt: "2026-09-10T18:00:00.000Z",
  contactNames: ["Sam", "Priya"],
};

test("create() issues a distinct share code per trusted contact", () => {
  const store = new SharedDateStore();
  const result = store.create("alice", VALID_PAYLOAD);
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.date.contacts.length, 2);
  assert.notEqual(result.date.contacts[0].shareCode, result.date.contacts[1].shareCode);
  assert.equal(result.date.status, "planned");
});

test("create() rejects missing author, meetingWith, location, or contacts", () => {
  const store = new SharedDateStore();
  assert.equal(store.create("", VALID_PAYLOAD).success, false);
  assert.equal(store.create("alice", { ...VALID_PAYLOAD, meetingWith: "" }).success, false);
  assert.equal(store.create("alice", { ...VALID_PAYLOAD, location: "" }).success, false);
  assert.equal(store.create("alice", { ...VALID_PAYLOAD, contactNames: [] }).success, false);
});

test("create() rejects an invalid scheduledAt", () => {
  const store = new SharedDateStore();
  assert.equal(store.create("alice", { ...VALID_PAYLOAD, scheduledAt: "not-a-date" }).success, false);
});

test("updateStatus() only allows the original sharer to update, with a valid status", () => {
  const store = new SharedDateStore();
  const created = store.create("alice", VALID_PAYLOAD);
  assert.equal(created.success, true);
  if (!created.success) return;

  const forbidden = store.updateStatus("mallory", created.date.id, "safe");
  assert.equal(forbidden.success, false);

  const invalidStatus = store.updateStatus("alice", created.date.id, "on_vacation");
  assert.equal(invalidStatus.success, false);

  const ok = store.updateStatus("alice", created.date.id, "on_the_way");
  assert.equal(ok.success, true);
  if (ok.success) assert.equal(ok.date.status, "on_the_way");
});

test("viewByShareCode() reflects live status updates and hides internal ids", () => {
  const store = new SharedDateStore();
  const created = store.create("alice", VALID_PAYLOAD);
  assert.equal(created.success, true);
  if (!created.success) return;

  store.updateStatus("alice", created.date.id, "arrived");
  const view = store.viewByShareCode(created.date.contacts[0].shareCode);
  assert.equal(view?.status, "arrived");
  assert.equal((view as unknown as { id?: string }).id, undefined);
});

test("revoke() invalidates every contact's share code and only works for the sharer", () => {
  const store = new SharedDateStore();
  const created = store.create("alice", VALID_PAYLOAD);
  assert.equal(created.success, true);
  if (!created.success) return;

  assert.equal(store.revoke("mallory", created.date.id), false);
  assert.equal(store.revoke("alice", created.date.id), true);

  for (const contact of created.date.contacts) {
    assert.equal(store.viewByShareCode(contact.shareCode), undefined);
  }
});

test("viewByShareCode() returns undefined for an unknown code", () => {
  const store = new SharedDateStore();
  assert.equal(store.viewByShareCode("does-not-exist"), undefined);
});

test("create() attaches a positionally-matched phone to each contact (#314)", () => {
  const store = new SharedDateStore();
  const result = store.create("alice", { ...VALID_PAYLOAD, contactPhones: ["+15551234567", ""] });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.date.contacts[0].phone, "+15551234567");
  assert.equal(result.date.contacts[1].phone, undefined);
});

test("create() starts noResponseAlertSent as false (#314)", () => {
  const store = new SharedDateStore();
  const result = store.create("alice", VALID_PAYLOAD);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.date.noResponseAlertSent, false);
});

test("getDatesNeedingNoResponseAlert() includes a still-planned date past the window (#314)", () => {
  const store = new SharedDateStore();
  const result = store.create("alice", VALID_PAYLOAD);
  assert.equal(result.success, true);
  if (!result.success) return;

  const now = new Date(VALID_PAYLOAD.scheduledAt).getTime() + NO_RESPONSE_ALERT_WINDOW_MS + 1000;
  const needing = store.getDatesNeedingNoResponseAlert(now);
  assert.equal(needing.length, 1);
  assert.equal(needing[0].id, result.date.id);
});

test("getDatesNeedingNoResponseAlert() excludes a date still within the window (#314)", () => {
  const store = new SharedDateStore();
  store.create("alice", VALID_PAYLOAD);
  const now = new Date(VALID_PAYLOAD.scheduledAt).getTime() + 1000;
  assert.deepEqual(store.getDatesNeedingNoResponseAlert(now), []);
});

test("getDatesNeedingNoResponseAlert() excludes a date whose sharer already checked in (#314)", () => {
  const store = new SharedDateStore();
  const result = store.create("alice", VALID_PAYLOAD);
  assert.equal(result.success, true);
  if (!result.success) return;
  store.updateStatus("alice", result.date.id, "safe");

  const now = new Date(VALID_PAYLOAD.scheduledAt).getTime() + NO_RESPONSE_ALERT_WINDOW_MS + 1000;
  assert.deepEqual(store.getDatesNeedingNoResponseAlert(now), []);
});

test("getDatesNeedingNoResponseAlert() excludes a revoked date (#314)", () => {
  const store = new SharedDateStore();
  const result = store.create("alice", VALID_PAYLOAD);
  assert.equal(result.success, true);
  if (!result.success) return;
  store.revoke("alice", result.date.id);

  const now = new Date(VALID_PAYLOAD.scheduledAt).getTime() + NO_RESPONSE_ALERT_WINDOW_MS + 1000;
  assert.deepEqual(store.getDatesNeedingNoResponseAlert(now), []);
});

test("markNoResponseAlertSent() excludes the date from future sweeps (#314)", () => {
  const store = new SharedDateStore();
  const result = store.create("alice", VALID_PAYLOAD);
  assert.equal(result.success, true);
  if (!result.success) return;
  store.markNoResponseAlertSent(result.date.id);

  const now = new Date(VALID_PAYLOAD.scheduledAt).getTime() + NO_RESPONSE_ALERT_WINDOW_MS + 1000;
  assert.deepEqual(store.getDatesNeedingNoResponseAlert(now), []);
});
