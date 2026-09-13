import { SubscriptionStore, SubscriptionTier } from "./subscriptions";

/** This app's own catalog of Play Billing subscription product ids, mapped to #191's fixed tiers. */
export const GOOGLE_PLAY_PRODUCT_TO_TIER: Record<string, SubscriptionTier> = {
  gold_monthly: "gold",
  platinum_monthly: "platinum",
  vip_monthly: "vip",
};

/**
 * Real Real-time Developer Notification type codes, per Google's own
 * reference (developer.android.com/google/play/billing/rtdn-reference).
 * Only the codes that change entitlement are handled; grace period/hold/
 * price-change/pause nuance (5, 6, 8, 9, 10, 11) is acknowledged but
 * intentionally a no-op — same "not every real-world state transition"
 * scoping call other webhook-shaped features in this codebase make.
 */
const RENEWING_NOTIFICATION_TYPES = new Set([1, 2, 4, 7]); // RECOVERED, RENEWED, PURCHASED, RESTARTED
const ENDING_NOTIFICATION_TYPES = new Set([3, 12, 13]); // CANCELED, REVOKED, EXPIRED

export interface GooglePlaySubscriptionNotification {
  version: string;
  notificationType: number;
  purchaseToken: string;
  subscriptionId: string;
}

export interface GooglePlayRtdnPayload {
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: GooglePlaySubscriptionNotification;
}

/**
 * Decodes the Cloud Pub/Sub push envelope Google's Real-time Developer
 * Notifications actually arrive in: { message: { data: <base64 JSON> } }.
 * Returns undefined for anything that isn't that exact shape rather than
 * throwing, since a malformed webhook call should 400, not crash.
 */
export function parseGooglePlayRtdn(body: unknown): GooglePlayRtdnPayload | undefined {
  const data = (body as { message?: { data?: unknown } } | undefined)?.message?.data;
  if (typeof data !== "string") return undefined;
  try {
    return JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch {
    return undefined;
  }
}

export type LinkPurchaseResult = { success: true } | { success: false; error: string };
export type HandleNotificationResult = { success: true; action: "activated" | "cancelled" | "ignored" } | { success: false; error: string };

/**
 * Tinder's real "Google Play Billing in-app payment" (#193). This repo
 * has no native Android app (CLAUDE.md scopes this project web-first),
 * so there is no client that can actually drive Google Play's purchase
 * flow or a live Play Console subscription to receive real Real-time
 * Developer Notifications from — the same kind of platform-specific,
 * unprovisionable gap as Google/Apple Sign-In's credential requirement
 * elsewhere in this app, not a "web equivalent" situation like #5's Web
 * Push (which really does have one). What's real: the actual server-
 * side bridge a Play Billing integration needs regardless of platform —
 * linking the purchaseToken a client gets back immediately after a
 * successful purchase to this app's own author identity and #191's
 * SubscriptionStore entitlement, then keeping it in sync as Google's
 * real RTDN notification-type codes arrive (renewal, cancellation,
 * revocation). Verifying the Pub/Sub push request's signing JWT against
 * Google's public keys needs a live Pub/Sub push subscription's
 * audience configuration this environment doesn't have, so that check
 * is the one piece left undone — everything downstream of receiving the
 * notification is real.
 */
export class GooglePlayBillingBridge {
  private authorByPurchaseToken = new Map<string, string>();

  constructor(private readonly subscriptionStore: SubscriptionStore) {}

  linkPurchase(author: unknown, purchaseToken: unknown, productId: unknown): LinkPurchaseResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (typeof purchaseToken !== "string" || !purchaseToken) return { success: false, error: "purchaseToken is required" };
    const tier = typeof productId === "string" ? GOOGLE_PLAY_PRODUCT_TO_TIER[productId] : undefined;
    if (!tier) return { success: false, error: `productId must be one of: ${Object.keys(GOOGLE_PLAY_PRODUCT_TO_TIER).join(", ")}` };

    this.authorByPurchaseToken.set(purchaseToken, authorText);
    this.subscriptionStore.subscribe(authorText, tier);
    return { success: true };
  }

  handleNotification(notification: GooglePlaySubscriptionNotification): HandleNotificationResult {
    const author = this.authorByPurchaseToken.get(notification.purchaseToken);
    if (!author) return { success: false, error: "Unknown purchase token" };
    const tier = GOOGLE_PLAY_PRODUCT_TO_TIER[notification.subscriptionId];

    if (RENEWING_NOTIFICATION_TYPES.has(notification.notificationType) && tier) {
      this.subscriptionStore.subscribe(author, tier);
      return { success: true, action: "activated" };
    }
    if (ENDING_NOTIFICATION_TYPES.has(notification.notificationType)) {
      this.subscriptionStore.cancel(author);
      return { success: true, action: "cancelled" };
    }
    return { success: true, action: "ignored" };
  }
}
