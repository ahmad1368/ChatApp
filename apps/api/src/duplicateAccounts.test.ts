import { test } from "node:test";
import assert from "node:assert/strict";
import { DuplicateAccountStore } from "./duplicateAccounts";

test("a lone account is never flagged", () => {
  const store = new DuplicateAccountStore();
  store.recordSignIn("user-1", "1.2.3.4", "fingerprint-a");
  assert.deepEqual(store.getStatus("user-1"), { flagged: false, matchedUserIds: [] });
});

test("two accounts sharing an IP are both flagged against each other", () => {
  const store = new DuplicateAccountStore();
  store.recordSignIn("user-1", "1.2.3.4", "fingerprint-a");
  store.recordSignIn("user-2", "1.2.3.4", "fingerprint-b");

  assert.deepEqual(store.getStatus("user-1"), { flagged: true, matchedUserIds: ["user-2"] });
  assert.deepEqual(store.getStatus("user-2"), { flagged: true, matchedUserIds: ["user-1"] });
});

test("two accounts sharing only a device fingerprint (different IPs) are flagged", () => {
  const store = new DuplicateAccountStore();
  store.recordSignIn("user-1", "1.2.3.4", "fingerprint-shared");
  store.recordSignIn("user-2", "5.6.7.8", "fingerprint-shared");

  assert.equal(store.getStatus("user-1").flagged, true);
  assert.equal(store.getStatus("user-2").flagged, true);
});

test("accounts with different IP and fingerprint are not flagged", () => {
  const store = new DuplicateAccountStore();
  store.recordSignIn("user-1", "1.2.3.4", "fingerprint-a");
  store.recordSignIn("user-2", "5.6.7.8", "fingerprint-b");

  assert.equal(store.getStatus("user-1").flagged, false);
  assert.equal(store.getStatus("user-2").flagged, false);
});

test("re-recording a sign-in for the same account doesn't self-match", () => {
  const store = new DuplicateAccountStore();
  store.recordSignIn("user-1", "1.2.3.4", "fingerprint-a");
  store.recordSignIn("user-1", "1.2.3.4", "fingerprint-a");
  assert.deepEqual(store.getStatus("user-1"), { flagged: false, matchedUserIds: [] });
});

test("a third account joining an existing pair is flagged against both, and they against it", () => {
  const store = new DuplicateAccountStore();
  store.recordSignIn("user-1", "1.2.3.4", "fingerprint-a");
  store.recordSignIn("user-2", "1.2.3.4", "fingerprint-b");
  store.recordSignIn("user-3", "1.2.3.4", "fingerprint-c");

  const status3 = store.getStatus("user-3");
  assert.equal(status3.flagged, true);
  assert.deepEqual(new Set(status3.matchedUserIds), new Set(["user-1", "user-2"]));
  assert.deepEqual(new Set(store.getStatus("user-1").matchedUserIds), new Set(["user-2", "user-3"]));
});

test("ignores a missing userId, IP, or fingerprint without throwing", () => {
  const store = new DuplicateAccountStore();
  store.recordSignIn("", "1.2.3.4", "fingerprint-a");
  store.recordSignIn("user-1", undefined, undefined);
  assert.deepEqual(store.getStatus("user-1"), { flagged: false, matchedUserIds: [] });
});

test("getFlaggedClusters() (#181) is empty with no shared signals", () => {
  const store = new DuplicateAccountStore();
  store.recordSignIn("user-1", "1.2.3.4", "fingerprint-a");
  assert.deepEqual(store.getFlaggedClusters(), []);
});

test("getFlaggedClusters() (#181) groups accounts sharing an IP into one cluster", () => {
  const store = new DuplicateAccountStore();
  store.recordSignIn("user-1", "1.2.3.4", "fingerprint-a");
  store.recordSignIn("user-2", "1.2.3.4", "fingerprint-b");

  const clusters = store.getFlaggedClusters();
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].signal, "ipAddress");
  assert.deepEqual(new Set(clusters[0].userIds), new Set(["user-1", "user-2"]));
});

test("getFlaggedClusters() (#181) reports both an IP cluster and a separate device cluster", () => {
  const store = new DuplicateAccountStore();
  store.recordSignIn("user-1", "1.2.3.4", "fingerprint-a");
  store.recordSignIn("user-2", "1.2.3.4", "fingerprint-b");
  store.recordSignIn("user-3", "9.9.9.9", "fingerprint-shared");
  store.recordSignIn("user-4", "8.8.8.8", "fingerprint-shared");

  const clusters = store.getFlaggedClusters();
  assert.equal(clusters.length, 2);
  assert.deepEqual(
    new Set(clusters.map((c) => c.signal)),
    new Set(["ipAddress", "deviceFingerprint"])
  );
});

test("getFlaggedClusters() (#181) sorts the largest cluster first", () => {
  const store = new DuplicateAccountStore();
  store.recordSignIn("user-1", "1.2.3.4", "fingerprint-a");
  store.recordSignIn("user-2", "1.2.3.4", "fingerprint-b");
  store.recordSignIn("user-3", "9.9.9.9", "fingerprint-shared");
  store.recordSignIn("user-4", "8.8.8.8", "fingerprint-shared");
  store.recordSignIn("user-5", "8.8.8.8", "fingerprint-shared");

  const clusters = store.getFlaggedClusters();
  assert.equal(clusters[0].userIds.length, 3);
  assert.equal(clusters[0].signal, "deviceFingerprint");
});
