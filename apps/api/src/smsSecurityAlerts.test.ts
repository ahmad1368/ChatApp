import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SmsSecurityAlertStore } from "./smsSecurityAlerts";

describe("SmsSecurityAlertStore", () => {
  it("sends a login alert by default and records it", () => {
    const store = new SmsSecurityAlertStore();
    const sent = store.notify("user-1", "+15551234567", "login", "New sign-in from Chrome on Windows.");

    assert.equal(sent, true);
    assert.deepEqual(store.getSentAlerts("user-1").map((a) => a.message), ["New sign-in from Chrome on Windows."]);
  });

  it("does not send when the user has no phone number on file", () => {
    const store = new SmsSecurityAlertStore();
    const sent = store.notify("user-1", undefined, "login", "New sign-in.");

    assert.equal(sent, false);
    assert.deepEqual(store.getSentAlerts("user-1"), []);
  });

  it("respects a per-category opt-out", () => {
    const store = new SmsSecurityAlertStore();
    store.setPreference("user-1", "login", false);

    const loginSent = store.notify("user-1", "+15551234567", "login", "New sign-in.");
    const securitySent = store.notify("user-1", "+15551234567", "accountSecurity", "2FA disabled.");

    assert.equal(loginSent, false);
    assert.equal(securitySent, true);
    assert.deepEqual(store.getSentAlerts("user-1").map((a) => a.category), ["accountSecurity"]);
  });

  it("defaults both categories to enabled for a user with no saved preferences", () => {
    const store = new SmsSecurityAlertStore();
    assert.deepEqual(store.getPreferences("user-1"), { login: true, accountSecurity: true });
  });

  it("rejects an invalid category", () => {
    const store = new SmsSecurityAlertStore();
    const result = store.setPreference("user-1", "billing", true);
    assert.deepEqual(result, { success: false, error: "category must be one of: login, accountSecurity" });
  });

  it("rejects a missing userId", () => {
    const store = new SmsSecurityAlertStore();
    const result = store.setPreference("", "login", true);
    assert.deepEqual(result, { success: false, error: "userId is required" });
  });

  it("keeps preferences isolated per user", () => {
    const store = new SmsSecurityAlertStore();
    store.setPreference("user-1", "login", false);

    assert.deepEqual(store.getPreferences("user-2"), { login: true, accountSecurity: true });
  });
});
