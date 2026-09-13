import { SubscriptionStore, SubscriptionTier } from "./subscriptions";

/** This app's own catalog of App Store product ids, mapped to #191's fixed tiers. */
export const APPLE_PRODUCT_TO_TIER: Record<string, SubscriptionTier> = {
  "com.chatapp.gold.monthly": "gold",
  "com.chatapp.platinum.monthly": "platinum",
  "com.chatapp.vip.monthly": "vip",
};

/**
 * Real App Store Server Notifications V2 notificationType values, per
 * Apple's own reference (developer.apple.com/documentation/appstoreservernotifications).
 * Only the values that change entitlement are handled; DID_CHANGE_RENEWAL_STATUS,
 * GRACE_PERIOD_EXPIRED, PRICE_INCREASE, OFFER_REDEEMED, etc. are
 * acknowledged but intentionally a no-op — same scoping call
 * googlePlayBilling.ts makes for Google's own non-entitlement-changing
 * notification types.
 */
const RENEWING_NOTIFICATION_TYPES = new Set(["SUBSCRIBED", "DID_RENEW"]);
const ENDING_NOTIFICATION_TYPES = new Set(["EXPIRED", "REFUND", "REVOKE"]);

export interface AppleTransactionInfo {
  originalTransactionId: string;
  productId: string;
}

export interface AppleNotification {
  notificationType: string;
  subtype?: string;
  transactionInfo: AppleTransactionInfo;
}

/**
 * Decodes one unverified JWS payload segment (base64url) — used for both
 * the outer App Store Server Notification and the nested
 * signedTransactionInfo it carries, both real JWS-in-JSON shapes Apple
 * actually sends. Verifying the signature chain against Apple's root CA
 * needs Apple's live certificate chain this environment doesn't have —
 * the same disclosed gap as googlePlayBilling.ts's Pub/Sub JWT audience
 * check — so only the payload is extracted, never trust-verified.
 */
function decodeJwsPayload(jws: string): Record<string, unknown> | undefined {
  const segments = jws.split(".");
  if (segments.length !== 3) return undefined;
  try {
    const json = Buffer.from(segments[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/**
 * Parses a real App Store Server Notification V2 request body:
 * { signedPayload: "<JWS whose payload is
 *     { notificationType, subtype?, data: { signedTransactionInfo: "<JWS>" } }>" }
 */
export function parseAppleNotification(body: unknown): AppleNotification | undefined {
  const signedPayload = (body as { signedPayload?: unknown } | undefined)?.signedPayload;
  if (typeof signedPayload !== "string") return undefined;
  const outer = decodeJwsPayload(signedPayload);
  const notificationType = outer?.notificationType;
  const signedTransactionInfo = (outer?.data as { signedTransactionInfo?: unknown } | undefined)?.signedTransactionInfo;
  if (typeof notificationType !== "string" || typeof signedTransactionInfo !== "string") return undefined;

  const transaction = decodeJwsPayload(signedTransactionInfo);
  const originalTransactionId = transaction?.originalTransactionId;
  const productId = transaction?.productId;
  if (typeof originalTransactionId !== "string" || typeof productId !== "string") return undefined;

  const subtype = outer?.subtype;
  return {
    notificationType,
    subtype: typeof subtype === "string" ? subtype : undefined,
    transactionInfo: { originalTransactionId, productId },
  };
}

export type LinkPurchaseResult = { success: true } | { success: false; error: string };
export type HandleNotificationResult = { success: true; action: "activated" | "cancelled" | "ignored" } | { success: false; error: string };

/**
 * Tinder's real "Apple In-App Purchase" (#194) — the iOS counterpart to
 * #193's GooglePlayBillingBridge, same honest scoping: this repo has no
 * native iOS app to actually drive a StoreKit purchase or an App Store
 * Connect subscription to receive real Server Notifications from. What's
 * real: the server-side bridge linking the originalTransactionId a
 * client gets back after a StoreKit purchase to this app's author
 * identity and #191's SubscriptionStore, then staying in sync via
 * Apple's real notificationType values.
 */
export class AppleAppStoreBridge {
  private authorByOriginalTransactionId = new Map<string, string>();

  constructor(private readonly subscriptionStore: SubscriptionStore) {}

  linkPurchase(author: unknown, originalTransactionId: unknown, productId: unknown): LinkPurchaseResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (typeof originalTransactionId !== "string" || !originalTransactionId) {
      return { success: false, error: "originalTransactionId is required" };
    }
    const tier = typeof productId === "string" ? APPLE_PRODUCT_TO_TIER[productId] : undefined;
    if (!tier) return { success: false, error: `productId must be one of: ${Object.keys(APPLE_PRODUCT_TO_TIER).join(", ")}` };

    this.authorByOriginalTransactionId.set(originalTransactionId, authorText);
    this.subscriptionStore.subscribe(authorText, tier);
    return { success: true };
  }

  handleNotification(notification: AppleNotification): HandleNotificationResult {
    const author = this.authorByOriginalTransactionId.get(notification.transactionInfo.originalTransactionId);
    if (!author) return { success: false, error: "Unknown originalTransactionId" };
    const tier = APPLE_PRODUCT_TO_TIER[notification.transactionInfo.productId];

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
