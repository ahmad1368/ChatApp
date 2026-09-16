import { test } from "node:test";
import assert from "node:assert/strict";
import { DateNoResponseAlertStore } from "./dateNoResponseAlerts";

test("send() records the alert", () => {
  const store = new DateNoResponseAlertStore();
  store.send("date-1", "Sam", "+15551234567", "Alice hasn't checked in after their date.");
  const alerts = store.getSentAlerts("date-1");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].contactName, "Sam");
  assert.equal(alerts[0].phone, "+15551234567");
});

test("getSentAlerts() returns an empty list before any alert (date-1)", () => {
  const store = new DateNoResponseAlertStore();
  assert.deepEqual(store.getSentAlerts("date-1"), []);
});

test("alerts are tracked independently per date", () => {
  const store = new DateNoResponseAlertStore();
  store.send("date-1", "Sam", "+15551234567", "message");
  assert.deepEqual(store.getSentAlerts("date-2"), []);
});

test("multiple contacts for the same date each get their own record", () => {
  const store = new DateNoResponseAlertStore();
  store.send("date-1", "Sam", "+15551234567", "message");
  store.send("date-1", "Priya", "+15559876543", "message");
  assert.equal(store.getSentAlerts("date-1").length, 2);
});
