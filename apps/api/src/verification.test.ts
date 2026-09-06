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

  it("marks a user verified after a valid selfie", () => {
    const store = new VerificationStore();
    const result = store.saveSelfie("user-1", "image/png", TINY_PNG_BASE64);
    assert.deepEqual(result, { success: true });
    assert.equal(store.isVerified("user-1"), true);
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
    assert.equal(store.isVerified("user-1"), true);
    assert.equal(store.isVerified("user-2"), false);
  });
});
