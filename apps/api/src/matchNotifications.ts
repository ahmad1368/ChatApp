export interface PushNotificationPayload {
  title: string;
  body: string;
}

/**
 * Tinder's real "Push notification for a new Match" (#151) — the actual
 * notification content, kept as its own pure function (like
 * messages.ts's buildChatMessage) so it's unit-testable independent of
 * push.ts's real web-push I/O, which server.ts's POST /api/swipes calls
 * once per side of a fresh match via PushService.notifyAuthor().
 */
export function buildNewMatchNotification(matchedAuthor: string): PushNotificationPayload {
  return { title: "New Match! 🎉", body: `You and ${matchedAuthor} have matched!` };
}
