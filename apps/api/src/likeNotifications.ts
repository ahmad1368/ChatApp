export interface PushNotificationPayload {
  title: string;
  body: string;
}

/**
 * Tinder's real "Notification for a new like (explicit or anonymous)"
 * (#153) — deliberately generic/non-identifying content, unlike
 * matchNotifications.ts's #151 match notification which does name the
 * other person: a match implies mutual interest already established,
 * but a one-sided like hasn't been reciprocated yet, and a push
 * notification can sit on a lock screen anyone nearby might glance at.
 * The "(explicit or anonymous)" in the issue title maps to this: the
 * notification itself never reveals who, even though #103's "Likes You"
 * list in-app shows the full identity once opened (this app has no
 * premium paywall to gate that reveal behind, per that feature's own
 * scoping note) — the anonymity here is a privacy choice about the
 * notification surface, not a monetization gate.
 */
export function buildNewLikeNotification(isSuperLike: boolean): PushNotificationPayload {
  return isSuperLike
    ? { title: "Someone Super Liked you! ⭐", body: "Open the app to see who." }
    : { title: "Someone likes you! 💕", body: "Open the app to see who." };
}
