import test from "node:test";
import assert from "node:assert/strict";
import { SubscriptionStore } from "./subscriptions";
import { AppleAppStoreBridge, parseAppleNotification } from "./appleAppStore";

function encodeJws(payload: unknown): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-signature`;
}

function buildNotification(notificationType: string, originalTransactionId: string, productId: string) {
  const signedTransactionInfo = encodeJws({ originalTransactionId, productId });
  const signedPayload = encodeJws({ notificationType, data: { signedTransactionInfo } });
  return { signedPayload };
}

test("parseAppleNotification() decodes a real nested-JWS App Store Server Notification V2 body", () => {
  const body = buildNotification("DID_RENEW", "txn-1", "com.chatapp.gold.monthly");
  const parsed = parseAppleNotification(body);
  assert.deepEqual(parsed, {
    notificationType: "DID_RENEW",
    subtype: undefined,
    transactionInfo: { originalTransactionId: "txn-1", productId: "com.chatapp.gold.monthly" },
  });
});

test("parseAppleNotification() returns undefined for a malformed body instead of throwing", () => {
  assert.equal(parseAppleNotification({}), undefined);
  assert.equal(parseAppleNotification({ signedPayload: "not-a-jws" }), undefined);
  assert.equal(parseAppleNotification({ signedPayload: encodeJws({ notificationType: "DID_RENEW" }) }), undefined);
});

test("linkPurchase() rejects a missing author, missing originalTransactionId, or unknown product id", () => {
  const bridge = new AppleAppStoreBridge(new SubscriptionStore());
  assert.equal(bridge.linkPurchase("", "txn-1", "com.chatapp.gold.monthly").success, false);
  assert.equal(bridge.linkPurchase("alice", "", "com.chatapp.gold.monthly").success, false);
  assert.equal(bridge.linkPurchase("alice", "txn-1", "com.unknown.product").success, false);
});

test("linkPurchase() activates the mapped tier immediately", () => {
  const subscriptionStore = new SubscriptionStore();
  const bridge = new AppleAppStoreBridge(subscriptionStore);
  const result = bridge.linkPurchase("alice", "txn-1", "com.chatapp.vip.monthly");
  assert.equal(result.success, true);
  assert.equal(subscriptionStore.getStatus("alice")?.tier, "vip");
});

test("handleNotification() rejects an unknown originalTransactionId", () => {
  const bridge = new AppleAppStoreBridge(new SubscriptionStore());
  const result = bridge.handleNotification({ notificationType: "DID_RENEW", transactionInfo: { originalTransactionId: "txn-1", productId: "com.chatapp.gold.monthly" } });
  assert.equal(result.success, false);
});

test("handleNotification() renews on DID_RENEW and extends the same tier", () => {
  const subscriptionStore = new SubscriptionStore();
  const bridge = new AppleAppStoreBridge(subscriptionStore);
  bridge.linkPurchase("alice", "txn-1", "com.chatapp.gold.monthly");

  const result = bridge.handleNotification({ notificationType: "DID_RENEW", transactionInfo: { originalTransactionId: "txn-1", productId: "com.chatapp.gold.monthly" } });
  assert.equal(result.success, true);
  assert.equal(result.success && result.action, "activated");
  assert.equal(subscriptionStore.getStatus("alice")?.tier, "gold");
});

test("handleNotification() cancels the subscription on EXPIRED, REFUND, and REVOKE", () => {
  for (const notificationType of ["EXPIRED", "REFUND", "REVOKE"]) {
    const subscriptionStore = new SubscriptionStore();
    const bridge = new AppleAppStoreBridge(subscriptionStore);
    bridge.linkPurchase("alice", "txn-1", "com.chatapp.gold.monthly");

    const result = bridge.handleNotification({ notificationType, transactionInfo: { originalTransactionId: "txn-1", productId: "com.chatapp.gold.monthly" } });
    assert.equal(result.success, true);
    assert.equal(result.success && result.action, "cancelled");
    assert.equal(subscriptionStore.getStatus("alice"), undefined);
  }
});

test("handleNotification() ignores a notification type this app doesn't act on, without touching entitlement", () => {
  const subscriptionStore = new SubscriptionStore();
  const bridge = new AppleAppStoreBridge(subscriptionStore);
  bridge.linkPurchase("alice", "txn-1", "com.chatapp.gold.monthly");

  const result = bridge.handleNotification({ notificationType: "PRICE_INCREASE", transactionInfo: { originalTransactionId: "txn-1", productId: "com.chatapp.gold.monthly" } });
  assert.equal(result.success, true);
  assert.equal(result.success && result.action, "ignored");
  assert.equal(subscriptionStore.getStatus("alice")?.tier, "gold");
});
