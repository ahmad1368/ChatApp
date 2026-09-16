import { test } from "node:test";
import assert from "node:assert/strict";
import { LanguageCertificateStore } from "./languageCertificate";

const TINY_BASE64 = Buffer.from("not a real certificate, just bytes").toString("base64");

test("submit() rejects a missing author", () => {
  const store = new LanguageCertificateStore();
  const result = store.submit("", "IELTS", "7.5", "image/jpeg", TINY_BASE64);
  assert.equal(result.success, false);
});

test("submit() rejects an invalid examType", () => {
  const store = new LanguageCertificateStore();
  const result = store.submit("alice", "DUOLINGO", "7.5", "image/jpeg", TINY_BASE64);
  assert.equal(result.success, false);
});

test("submit() rejects a missing score", () => {
  const store = new LanguageCertificateStore();
  const result = store.submit("alice", "IELTS", "", "image/jpeg", TINY_BASE64);
  assert.equal(result.success, false);
});

test("submit() rejects an unsupported mime type", () => {
  const store = new LanguageCertificateStore();
  const result = store.submit("alice", "IELTS", "7.5", "application/x-msdownload", TINY_BASE64);
  assert.equal(result.success, false);
});

test("submit() accepts a PDF certificate", () => {
  const store = new LanguageCertificateStore();
  const result = store.submit("alice", "TOEFL", "100", "application/pdf", TINY_BASE64);
  assert.equal(result.success, true);
});

test("submit() rejects an oversized certificate", () => {
  const store = new LanguageCertificateStore();
  const oversized = Buffer.alloc(11 * 1024 * 1024).toString("base64");
  const result = store.submit("alice", "IELTS", "7.5", "image/jpeg", oversized);
  assert.equal(result.success, false);
});

test("submit() starts a submission as pending, not auto-verified", () => {
  const store = new LanguageCertificateStore();
  store.submit("alice", "IELTS", "7.5", "image/jpeg", TINY_BASE64);
  assert.equal(store.isVerified("alice"), false);
  assert.deepEqual(store.getStatus("alice"), { status: "pending", examType: "IELTS", score: "7.5" });
});

test("getStatus() returns null before any submission", () => {
  const store = new LanguageCertificateStore();
  assert.equal(store.getStatus("alice"), null);
});

test("getPendingQueue() lists pending submissions oldest first", () => {
  const store = new LanguageCertificateStore();
  store.submit("alice", "IELTS", "7.5", "image/jpeg", TINY_BASE64);
  store.submit("bob", "TOEFL", "100", "image/jpeg", TINY_BASE64);
  const queue = store.getPendingQueue();
  assert.equal(queue.length, 2);
  assert.deepEqual(
    queue.map((e) => e.author),
    ["alice", "bob"]
  );
});

test("review() rejects a missing author, reviewer, or invalid status", () => {
  const store = new LanguageCertificateStore();
  store.submit("alice", "IELTS", "7.5", "image/jpeg", TINY_BASE64);
  assert.equal(store.review("", "admin", "approved").success, false);
  assert.equal(store.review("alice", "", "approved").success, false);
  assert.equal(store.review("alice", "admin", "maybe").success, false);
});

test("review() rejects reviewing an author with no submission", () => {
  const store = new LanguageCertificateStore();
  const result = store.review("alice", "admin", "approved");
  assert.equal(result.success, false);
});

test("review() approving marks the certificate verified and removes it from the queue", () => {
  const store = new LanguageCertificateStore();
  store.submit("alice", "IELTS", "7.5", "image/jpeg", TINY_BASE64);
  const result = store.review("alice", "admin", "approved");
  assert.deepEqual(result, { success: true, status: "approved" });
  assert.equal(store.isVerified("alice"), true);
  assert.deepEqual(store.getPendingQueue(), []);
});

test("review() rejecting does not verify the certificate", () => {
  const store = new LanguageCertificateStore();
  store.submit("alice", "IELTS", "7.5", "image/jpeg", TINY_BASE64);
  store.review("alice", "admin", "rejected");
  assert.equal(store.isVerified("alice"), false);
  assert.equal(store.getStatus("alice")?.status, "rejected");
});

test("getCertificateForReview() returns the raw file for admin review", () => {
  const store = new LanguageCertificateStore();
  store.submit("alice", "IELTS", "7.5", "image/jpeg", TINY_BASE64);
  const cert = store.getCertificateForReview("alice");
  assert.equal(cert?.mimeType, "image/jpeg");
  assert.deepEqual(cert?.data, Buffer.from(TINY_BASE64, "base64"));
});

test("getCertificateForReview() returns undefined for an unknown author", () => {
  const store = new LanguageCertificateStore();
  assert.equal(store.getCertificateForReview("alice"), undefined);
});

test("submissions are tracked independently per author", () => {
  const store = new LanguageCertificateStore();
  store.submit("alice", "IELTS", "7.5", "image/jpeg", TINY_BASE64);
  assert.equal(store.getStatus("bob"), null);
});
