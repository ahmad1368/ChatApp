import { test } from "node:test";
import assert from "node:assert/strict";
import { StudentVerificationStore, isUniversityEmail } from "./studentVerification";

test("isUniversityEmail accepts a .edu address", () => {
  assert.equal(isUniversityEmail("alice@stanford.edu"), true);
});

test("isUniversityEmail accepts a country-suffixed .edu.xx address", () => {
  assert.equal(isUniversityEmail("bob@unimelb.edu.au"), true);
});

test("isUniversityEmail rejects a non-university address", () => {
  assert.equal(isUniversityEmail("alice@gmail.com"), false);
});

test("isUniversityEmail rejects a non-string value", () => {
  assert.equal(isUniversityEmail(undefined), false);
});

test("requestVerification rejects a non-university email", () => {
  const store = new StudentVerificationStore();
  const result = store.requestVerification("alice", "alice@gmail.com");
  assert.equal(result.success, false);
});

test("requestVerification succeeds for a .edu email and returns a 6-digit code", () => {
  const store = new StudentVerificationStore();
  const result = store.requestVerification("alice", "alice@stanford.edu");
  assert.equal(result.success, true);
  if (result.success) {
    assert.match(result.code, /^\d{6}$/);
  }
});

test("requestVerification enforces a resend cooldown", () => {
  const store = new StudentVerificationStore();
  store.requestVerification("alice", "alice@stanford.edu");
  const second = store.requestVerification("alice", "alice@stanford.edu");
  assert.equal(second.success, false);
});

test("confirmVerification succeeds with the correct code", () => {
  const store = new StudentVerificationStore();
  const requested = store.requestVerification("alice", "alice@stanford.edu");
  assert.equal(requested.success, true);
  if (!requested.success) return;
  const confirmed = store.confirmVerification("alice", requested.code);
  assert.deepEqual(confirmed, { success: true });
  assert.equal(store.isVerified("alice"), true);
});

test("confirmVerification rejects an incorrect code and decrements attempts", () => {
  const store = new StudentVerificationStore();
  store.requestVerification("alice", "alice@stanford.edu");
  const result = store.confirmVerification("alice", "000000");
  assert.equal(result.success, false);
  assert.equal(store.isVerified("alice"), false);
});

test("confirmVerification rejects when there is no pending request", () => {
  const store = new StudentVerificationStore();
  const result = store.confirmVerification("alice", "123456");
  assert.equal(result.success, false);
});

test("confirmVerification locks out after too many incorrect attempts", () => {
  const store = new StudentVerificationStore();
  store.requestVerification("alice", "alice@stanford.edu");
  for (let i = 0; i < 5; i++) {
    store.confirmVerification("alice", "000000");
  }
  const result = store.confirmVerification("alice", "000000");
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error, /request a new one/);
  }
});

test("isVerified is false before any verification", () => {
  const store = new StudentVerificationStore();
  assert.equal(store.isVerified("alice"), false);
});

test("getStatus reports the verified email once confirmed", () => {
  const store = new StudentVerificationStore();
  const requested = store.requestVerification("alice", "alice@stanford.edu");
  assert.equal(requested.success, true);
  if (!requested.success) return;
  store.confirmVerification("alice", requested.code);
  assert.deepEqual(store.getStatus("alice"), { verified: true, email: "alice@stanford.edu" });
});

test("getStatus reports unverified for an unknown author", () => {
  const store = new StudentVerificationStore();
  assert.deepEqual(store.getStatus("alice"), { verified: false });
});

test("verification is tracked independently per author", () => {
  const store = new StudentVerificationStore();
  const requested = store.requestVerification("alice", "alice@stanford.edu");
  assert.equal(requested.success, true);
  if (!requested.success) return;
  store.confirmVerification("alice", requested.code);
  assert.equal(store.isVerified("bob"), false);
});
