import webpush, { PushSubscription } from "web-push";

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

  /** Sends a push message to every subscriber except the message's own author. */
  async notifyOthers(author: string, payload: { title: string; body: string }): Promise<void> {
    const recipients = [...this.subscriptionsByEndpoint.values()].filter((s) => s.author !== author);
    await Promise.all(
      recipients.map(({ subscription }) =>
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
}
