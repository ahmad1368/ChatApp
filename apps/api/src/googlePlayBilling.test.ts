import test from "node:test";
import assert from "node:assert/strict";
import { SubscriptionStore } from "./subscriptions";
import { GooglePlayBillingBridge, parseGooglePlayRtdn } from "./googlePlayBilling";

function encodeRtdn(payload: unknown): { message: { data: string } } {
  return { message: { data: Buffer.from(JSON.stringify(payload)).toString("base64") } };
}

test("parseGooglePlayRtdn() decodes a real base64 Pub/Sub envelope", () => {
  const payload = {
    packageName: "com.chatapp",
    eventTimeMillis: "1700000000000",
    subscriptionNotification: { version: "1.0", notificationType: 4, purchaseToken: "tok-1", subscriptionId: "gold_monthly" },
  };
  const parsed = parseGooglePlayRtdn(encodeRtdn(payload));
  assert.deepEqual(parsed, payload);
});

test("parseGooglePlayRtdn() returns undefined for a malformed envelope instead of throwing", () => {
  assert.equal(parseGooglePlayRtdn({}), undefined);
  assert.equal(parseGooglePlayRtdn({ message: {} }), undefined);
  assert.equal(parseGooglePlayRtdn({ message: { data: "not-valid-base64-json!!" } }), undefined);
});

test("linkPurchase() rejects a missing author, missing purchaseToken, or unknown product id", () => {
  const bridge = new GooglePlayBillingBridge(new SubscriptionStore());
  assert.equal(bridge.linkPurchase("", "tok-1", "gold_monthly").success, false);
  assert.equal(bridge.linkPurchase("alice", "", "gold_monthly").success, false);
  assert.equal(bridge.linkPurchase("alice", "tok-1", "unknown_product").success, false);
});

test("linkPurchase() activates the mapped tier immediately", () => {
  const subscriptionStore = new SubscriptionStore();
  const bridge = new GooglePlayBillingBridge(subscriptionStore);
  const result = bridge.linkPurchase("alice", "tok-1", "vip_monthly");
  assert.equal(result.success, true);
  assert.equal(subscriptionStore.getStatus("alice")?.tier, "vip");
});

test("handleNotification() rejects an unknown purchase token", () => {
  const bridge = new GooglePlayBillingBridge(new SubscriptionStore());
  const result = bridge.handleNotification({ version: "1.0", notificationType: 2, purchaseToken: "tok-1", subscriptionId: "gold_monthly" });
  assert.equal(result.success, false);
});

test("handleNotification() renews on RENEWED (2) and extends the same tier", () => {
  const subscriptionStore = new SubscriptionStore();
  const bridge = new GooglePlayBillingBridge(subscriptionStore);
  bridge.linkPurchase("alice", "tok-1", "gold_monthly");

  const result = bridge.handleNotification({ version: "1.0", notificationType: 2, purchaseToken: "tok-1", subscriptionId: "gold_monthly" });
  assert.equal(result.success, true);
  assert.equal(result.success && result.action, "activated");
  assert.equal(subscriptionStore.getStatus("alice")?.tier, "gold");
});

test("handleNotification() cancels the subscription on CANCELED (3), REVOKED (12), and EXPIRED (13)", () => {
  for (const notificationType of [3, 12, 13]) {
    const subscriptionStore = new SubscriptionStore();
    const bridge = new GooglePlayBillingBridge(subscriptionStore);
    bridge.linkPurchase("alice", "tok-1", "gold_monthly");

    const result = bridge.handleNotification({ version: "1.0", notificationType, purchaseToken: "tok-1", subscriptionId: "gold_monthly" });
    assert.equal(result.success, true);
    assert.equal(result.success && result.action, "cancelled");
    assert.equal(subscriptionStore.getStatus("alice"), undefined);
  }
});

test("handleNotification() ignores a notification type this app doesn't act on, without touching entitlement", () => {
  const subscriptionStore = new SubscriptionStore();
  const bridge = new GooglePlayBillingBridge(subscriptionStore);
  bridge.linkPurchase("alice", "tok-1", "gold_monthly");

  const result = bridge.handleNotification({ version: "1.0", notificationType: 10, purchaseToken: "tok-1", subscriptionId: "gold_monthly" });
  assert.equal(result.success, true);
  assert.equal(result.success && result.action, "ignored");
  assert.equal(subscriptionStore.getStatus("alice")?.tier, "gold");
});
