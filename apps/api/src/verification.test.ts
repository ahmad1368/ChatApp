import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VerificationStore } from "./verification";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("VerificationStore", () => {
  it("is not verified before any selfie is submitted", () => {
    const store = new VerificationStore();
    assert.equal(store.isVerified("user-1"), false);
  });

  it("a submitted selfie starts pending, not verified (#174: needs admin approval)", () => {
    const store = new VerificationStore();
    const result = store.saveSelfie("user-1", "image/png", TINY_PNG_BASE64);
    assert.deepEqual(result, { success: true });
    assert.equal(store.isVerified("user-1"), false);
    assert.equal(store.getStatus("user-1"), "pending");
  });

  it("becomes verified only once an admin approves it", () => {
    const store = new VerificationStore();
    store.saveSelfie("user-1", "image/png", TINY_PNG_BASE64);
    store.review("user-1", "admin", "approved");
    assert.equal(store.isVerified("user-1"), true);
    assert.equal(store.getStatus("user-1"), "approved");
  });

  it("rejects an unsupported mime type", () => {
    const store = new VerificationStore();
    const result = store.saveSelfie("user-1", "image/gif", TINY_PNG_BASE64);
    assert.equal(result.success, false);
    assert.equal(store.isVerified("user-1"), false);
  });

  it("rejects empty image data", () => {
    const store = new VerificationStore();
    const result = store.saveSelfie("user-1", "image/png", "");
    assert.equal(result.success, false);
  });

  it("tracks verification independently per user", () => {
    const store = new VerificationStore();
    store.saveSelfie("user-1", "image/png", TINY_PNG_BASE64);
    store.review("user-1", "admin", "approved");
    assert.equal(store.isVerified("user-1"), true);
    assert.equal(store.isVerified("user-2"), false);
  });

  it("getPendingQueue() lists only pending submissions, oldest first", () => {
    const store = new VerificationStore();
    store.saveSelfie("user-1", "image/png", TINY_PNG_BASE64);
    store.saveSelfie("user-2", "image/png", TINY_PNG_BASE64);
    store.review("user-1", "admin", "approved");

    const queue = store.getPendingQueue();
    assert.deepEqual(
      queue.map((e) => e.userId),
      ["user-2"]
    );
  });

  it("review() rejects a missing userId", () => {
    const store = new VerificationStore();
    const result = store.review("", "admin", "approved");
    assert.deepEqual(result, { success: false, error: "userId is required" });
  });

  it("review() rejects a missing reviewer", () => {
    const store = new VerificationStore();
    store.saveSelfie("user-1", "image/png", TINY_PNG_BASE64);
    const result = store.review("user-1", "", "approved");
    assert.deepEqual(result, { success: false, error: "reviewer is required" });
  });

  it("review() rejects an invalid status", () => {
    const store = new VerificationStore();
    store.saveSelfie("user-1", "image/png", TINY_PNG_BASE64);
    const result = store.review("user-1", "admin", "maybe");
    assert.deepEqual(result, { success: false, error: "status must be 'approved' or 'rejected'" });
  });

  it("review() errors when no selfie was ever submitted", () => {
    const store = new VerificationStore();
    const result = store.review("user-1", "admin", "approved");
    assert.deepEqual(result, { success: false, error: "No selfie submission found for this user" });
  });

  it("rejecting a submission keeps isVerified() false", () => {
    const store = new VerificationStore();
    store.saveSelfie("user-1", "image/png", TINY_PNG_BASE64);
    store.review("user-1", "admin", "rejected");
    assert.equal(store.isVerified("user-1"), false);
    assert.equal(store.getStatus("user-1"), "rejected");
  });

  it("getSelfieForReview() returns the raw submission for a reviewer", () => {
    const store = new VerificationStore();
    store.saveSelfie("user-1", "image/png", TINY_PNG_BASE64);
    const selfie = store.getSelfieForReview("user-1");
    assert.equal(selfie?.mimeType, "image/png");
    assert.ok(selfie?.data instanceof Buffer);
  });

  it("getSelfieForReview() is undefined when nothing was submitted", () => {
    const store = new VerificationStore();
    assert.equal(store.getSelfieForReview("user-1"), undefined);
  });
});
