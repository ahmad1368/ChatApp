import webpush, { PushSubscription } from "web-push";

// `vibrate` is #160's real background vibration pattern — honored by
// sw.js's showNotification() even when the app isn't focused, unlike a
// custom ringtone/sound which the Push API has no cross-browser way to
// carry at all (see notificationSound.ts's doc comment).
export interface PushPayload {
  title: string;
  body: string;
  vibrate?: number[];
}

function loadVapidKeys() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
  }
  console.warn(
    "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — generating ephemeral keys for this process. " +
      "Existing push subscriptions will stop working on restart; set them in .env for stable delivery."
  );
  return webpush.generateVAPIDKeys();
}

export class PushService {
  private subscriptionsByEndpoint = new Map<string, { author: string; subscription: PushSubscription }>();
  readonly publicKey: string;

  constructor() {
    const { publicKey, privateKey } = loadVapidKeys();
    webpush.setVapidDetails("mailto:admin@chatapp.example", publicKey, privateKey);
    this.publicKey = publicKey;
  }

  subscribe(author: string, subscription: PushSubscription): void {
    this.subscriptionsByEndpoint.set(subscription.endpoint, { author, subscription });
  }

  unsubscribe(endpoint: string): void {
    this.subscriptionsByEndpoint.delete(endpoint);
  }

  private async sendToSubscriptions(subscriptions: PushSubscription[], payload: PushPayload): Promise<void> {
    await Promise.all(
      subscriptions.map((subscription) =>
        webpush.sendNotification(subscription, JSON.stringify(payload)).catch((err) => {
          // 404/410 means the browser dropped the subscription; stop targeting it.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            this.subscriptionsByEndpoint.delete(subscription.endpoint);
          } else {
            console.error("web-push send failed:", err?.statusCode, err?.body ?? err);
          }
        })
      )
    );
  }

  /**
   * Sends a push message to every subscriber except the message's own
   * author. `recipientAllowed` is #156's per-category preference check
   * (notificationPreferencesStore.isEnabled) — defaults to "everyone
   * allowed" so existing callers that don't pass one are unaffected.
   */
  async notifyOthers(
    author: string,
    payload: PushPayload,
    recipientAllowed: (recipient: string) => boolean = () => true
  ): Promise<void> {
    const recipients = [...this.subscriptionsByEndpoint.values()]
      .filter((s) => s.author !== author && recipientAllowed(s.author))
      .map((s) => s.subscription);
    await this.sendToSubscriptions(recipients, payload);
  }

  /**
   * Sends a push message to every subscription belonging to one specific
   * author (e.g. Tinder's real "new Match"/"new like"/"expiring chat"
   * pushes, #151/#153/#154) — unlike notifyOthers()'s broadcast to
   * everyone else, this targets a single person across however many
   * devices they've subscribed from.
   */
  async notifyAuthor(author: string, payload: PushPayload): Promise<void> {
    const recipients = [...this.subscriptionsByEndpoint.values()]
      .filter((s) => s.author === author)
      .map((s) => s.subscription);
    await this.sendToSubscriptions(recipients, payload);
  }

  /**
   * Sends a push message to every subscription belonging to any author in
   * a given set (e.g. Match.com's real "start of an in-app live event"
   * push, #155, going out to everyone who opted into that specific
   * event) — unlike notifyOthers()'s broadcast to literally everyone.
   */
  async notifyAuthors(authors: Iterable<string>, payload: PushPayload): Promise<void> {
    const authorSet = new Set(authors);
    const recipients = [...this.subscriptionsByEndpoint.values()]
      .filter((s) => authorSet.has(s.author))
      .map((s) => s.subscription);
    await this.sendToSubscriptions(recipients, payload);
  }
}
