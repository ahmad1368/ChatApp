import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { CryptoChargeStore, isCoinbaseWebhookConfigured, verifyCoinbaseWebhookSignature } from "./cryptoPayments";

test("create() rejects a missing author, non-positive amount, or missing description", () => {
  const store = new CryptoChargeStore();
  assert.equal(store.create("", 500, "Gold plan").success, false);
  assert.equal(store.create("alice", 0, "Gold plan").success, false);
  assert.equal(store.create("alice", -100, "Gold plan").success, false);
  assert.equal(store.create("alice", 1.5, "Gold plan").success, false);
  assert.equal(store.create("alice", 500, "").success, false);
});

test("create() succeeds with a pending status", () => {
  const store = new CryptoChargeStore();
  const result = store.create("alice", 999, "Gold plan");
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.charge.status, "pending");
  assert.equal(store.get(result.charge.id)?.id, result.charge.id);
});

test("markConfirmed() transitions a pending charge and can't be applied twice", () => {
  const store = new CryptoChargeStore();
  const result = store.create("alice", 999, "Gold plan");
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(store.markConfirmed(result.charge.id), true);
  assert.equal(store.get(result.charge.id)?.status, "confirmed");
  assert.equal(store.markConfirmed(result.charge.id), false);
  assert.equal(store.markFailed(result.charge.id), false);
});

test("markFailed() transitions a pending charge and can't be applied twice", () => {
  const store = new CryptoChargeStore();
  const result = store.create("alice", 999, "Gold plan");
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(store.markFailed(result.charge.id), true);
  assert.equal(store.get(result.charge.id)?.status, "failed");
  assert.equal(store.markFailed(result.charge.id), false);
  assert.equal(store.markConfirmed(result.charge.id), false);
});

test("markConfirmed()/markFailed() return false for an unknown charge id", () => {
  const store = new CryptoChargeStore();
  assert.equal(store.markConfirmed("does-not-exist"), false);
  assert.equal(store.markFailed("does-not-exist"), false);
});

test("isCoinbaseWebhookConfigured() reflects whether the env var is set", () => {
  const previous = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  delete process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  assert.equal(isCoinbaseWebhookConfigured(), false);
  process.env.COINBASE_COMMERCE_WEBHOOK_SECRET = "shh";
  assert.equal(isCoinbaseWebhookConfigured(), true);
  if (previous === undefined) delete process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  else process.env.COINBASE_COMMERCE_WEBHOOK_SECRET = previous;
});

test("verifyCoinbaseWebhookSignature() accepts a genuine HMAC-SHA256 signature over the exact raw body", () => {
  const previous = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  process.env.COINBASE_COMMERCE_WEBHOOK_SECRET = "test-webhook-secret";
  try {
    const rawBody = JSON.stringify({ event: { type: "charge:confirmed", data: { code: "abc123" } } });
    const signature = createHmac("sha256", "test-webhook-secret").update(rawBody).digest("hex");
    assert.equal(verifyCoinbaseWebhookSignature(rawBody, signature), true);
  } finally {
    if (previous === undefined) delete process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
    else process.env.COINBASE_COMMERCE_WEBHOOK_SECRET = previous;
  }
});

test("verifyCoinbaseWebhookSignature() rejects a tampered body, wrong secret, or malformed header", () => {
  const previous = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  process.env.COINBASE_COMMERCE_WEBHOOK_SECRET = "test-webhook-secret";
  try {
    const rawBody = JSON.stringify({ event: { type: "charge:confirmed", data: { code: "abc123" } } });
    const signature = createHmac("sha256", "test-webhook-secret").update(rawBody).digest("hex");

    assert.equal(verifyCoinbaseWebhookSignature(rawBody + "tampered", signature), false);
    assert.equal(verifyCoinbaseWebhookSignature(rawBody, createHmac("sha256", "wrong-secret").update(rawBody).digest("hex")), false);
    assert.equal(verifyCoinbaseWebhookSignature(rawBody, "not-hex!!"), false);
    assert.equal(verifyCoinbaseWebhookSignature(rawBody, undefined), false);
  } finally {
    if (previous === undefined) delete process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
    else process.env.COINBASE_COMMERCE_WEBHOOK_SECRET = previous;
  }
});

test("verifyCoinbaseWebhookSignature() fails closed when the webhook secret isn't configured", () => {
  const previous = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  delete process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  try {
    assert.equal(verifyCoinbaseWebhookSignature("{}", "aabbcc"), false);
  } finally {
    if (previous !== undefined) process.env.COINBASE_COMMERCE_WEBHOOK_SECRET = previous;
  }
});
