import { test } from "node:test";
import assert from "node:assert/strict";
import { SOSStore } from "./sos";

const VALID_LOCATION = { latitude: 37.7749, longitude: -122.4194, accuracy: 12 };

test("addContact() records an emergency contact and rejects missing fields", () => {
  const store = new SOSStore();
  const result = store.addContact("alice", "Sam", "+15551234567");
  assert.equal(result.success, true);
  assert.deepEqual(store.listContacts("alice"), [{ name: "Sam", contactMethod: "+15551234567" }]);

  assert.equal(store.addContact("alice", "", "+15551234567").success, false);
  assert.equal(store.addContact("alice", "Sam", "").success, false);
});

test("triggerSOS() rejects when no emergency contacts are registered", () => {
  const store = new SOSStore();
  const result = store.triggerSOS("alice", VALID_LOCATION);
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /no emergency contacts/i);
});

test("triggerSOS() rejects invalid coordinates", () => {
  const store = new SOSStore();
  store.addContact("alice", "Sam", "+15551234567");
  assert.equal(store.triggerSOS("alice", { latitude: 200, longitude: 0 }).success, false);
  assert.equal(store.triggerSOS("alice", { latitude: 0 }).success, false);
});

test("triggerSOS() issues a distinct share code per emergency contact", () => {
  const store = new SOSStore();
  store.addContact("alice", "Sam", "+15551234567");
  store.addContact("alice", "Priya", "priya@example.com");

  const result = store.triggerSOS("alice", VALID_LOCATION);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.alert.contacts.length, 2);
  assert.notEqual(result.alert.contacts[0].shareCode, result.alert.contacts[1].shareCode);
  assert.equal(result.alert.resolved, false);
});

test("updateLocation() only allows the alert owner to move a pin, and not after resolution", () => {
  const store = new SOSStore();
  store.addContact("alice", "Sam", "+15551234567");
  const created = store.triggerSOS("alice", VALID_LOCATION);
  assert.equal(created.success, true);
  if (!created.success) return;

  const forbidden = store.updateLocation("mallory", created.alert.id, { latitude: 1, longitude: 1 });
  assert.equal(forbidden.success, false);

  const moved = store.updateLocation("alice", created.alert.id, { latitude: 1, longitude: 1 });
  assert.equal(moved.success, true);
  if (moved.success) assert.equal(moved.alert.location.latitude, 1);

  store.resolve("alice", created.alert.id);
  const afterResolved = store.updateLocation("alice", created.alert.id, { latitude: 2, longitude: 2 });
  assert.equal(afterResolved.success, false);
});

test("viewByShareCode() reflects location updates and resolution, hiding internal ids", () => {
  const store = new SOSStore();
  store.addContact("alice", "Sam", "+15551234567");
  const created = store.triggerSOS("alice", VALID_LOCATION);
  assert.equal(created.success, true);
  if (!created.success) return;

  store.updateLocation("alice", created.alert.id, { latitude: 5, longitude: 5 });
  const view = store.viewByShareCode(created.alert.contacts[0].shareCode);
  assert.equal(view?.location.latitude, 5);
  assert.equal(view?.resolved, false);
  assert.equal((view as unknown as { id?: string }).id, undefined);

  store.resolve("alice", created.alert.id);
  assert.equal(store.viewByShareCode(created.alert.contacts[0].shareCode)?.resolved, true);
});

test("viewByShareCode() returns undefined for an unknown code", () => {
  const store = new SOSStore();
  assert.equal(store.viewByShareCode("does-not-exist"), undefined);
});

test("resolve() only works for the alert's own author", () => {
  const store = new SOSStore();
  store.addContact("alice", "Sam", "+15551234567");
  const created = store.triggerSOS("alice", VALID_LOCATION);
  assert.equal(created.success, true);
  if (!created.success) return;

  assert.equal(store.resolve("mallory", created.alert.id), false);
  assert.equal(store.resolve("alice", created.alert.id), true);
});
