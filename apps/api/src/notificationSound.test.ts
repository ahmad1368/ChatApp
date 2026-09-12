import { test } from "node:test";
import assert from "node:assert/strict";
import { NotificationSoundStore } from "./notificationSound";

test("get() returns the default ringtone and vibration-on for a fresh author", () => {
  const store = new NotificationSoundStore();
  assert.deepEqual(store.get("alice"), { ringtone: "default", vibrationEnabled: true });
});

test("update() rejects a missing author", () => {
  const store = new NotificationSoundStore();
  const result = store.update("", { ringtone: "chime" });
  assert.equal(result.success, false);
});

test("update() rejects an unknown ringtone id", () => {
  const store = new NotificationSoundStore();
  const result = store.update("alice", { ringtone: "airhorn" });
  assert.equal(result.success, false);
});

test("update() rejects a non-boolean vibrationEnabled", () => {
  const store = new NotificationSoundStore();
  const result = store.update("alice", { vibrationEnabled: "yes" });
  assert.equal(result.success, false);
});

test("update() changes ringtone and persists it", () => {
  const store = new NotificationSoundStore();
  store.update("alice", { ringtone: "chime" });
  assert.equal(store.get("alice").ringtone, "chime");
});

test("update() turns off vibration independently of ringtone", () => {
  const store = new NotificationSoundStore();
  store.update("alice", { vibrationEnabled: false });
  const preference = store.get("alice");
  assert.equal(preference.vibrationEnabled, false);
  assert.equal(preference.ringtone, "default");
});

test("preferences are independent per author", () => {
  const store = new NotificationSoundStore();
  store.update("alice", { ringtone: "pop", vibrationEnabled: false });
  assert.deepEqual(store.get("bob"), { ringtone: "default", vibrationEnabled: true });
});

test("getVibrationPattern() returns the pattern when vibration is enabled (the default)", () => {
  const store = new NotificationSoundStore();
  assert.deepEqual(store.getVibrationPattern("alice", [200, 100, 200]), [200, 100, 200]);
});

test("getVibrationPattern() returns undefined once vibration is turned off", () => {
  const store = new NotificationSoundStore();
  store.update("alice", { vibrationEnabled: false });
  assert.equal(store.getVibrationPattern("alice", [200, 100, 200]), undefined);
});
