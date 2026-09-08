import { isValidCoordinates } from "./locationPrivacy";

// WhatsApp's real live-location durations top out at 8 hours.
export const MIN_LIVE_SHARE_MINUTES = 1;
export const MAX_LIVE_SHARE_MINUTES = 480;

export interface LiveLocationShare {
  author: string;
  latitude: number;
  longitude: number;
  expiresAt: string;
}

export type StartLiveShareResult = { success: true; expiresAt: string } | { success: false; error: string };
export type UpdateLiveShareResult =
  | { success: true; latitude: number; longitude: number }
  | { success: false; error: string };

/**
 * WhatsApp/Bumble's real "Share live location" (#127), extending #33/
 * #102's coordinate-validation infra to a chat message that keeps
 * updating for a bounded duration rather than a one-time pin. A one-time
 * ("text") location share needs no server-side tracking at all — it's
 * just coordinates (plus an optional text label) carried on the chat
 * message itself, same as #122's audioUrl/#123's selfDestructImageUrl;
 * this store only exists for the *live* case, which needs somewhere to
 * record in-flight position updates and when the share expires.
 */
export class LiveLocationShareStore {
  private shares = new Map<string, LiveLocationShare>();

  start(
    messageId: unknown,
    author: unknown,
    latitude: unknown,
    longitude: unknown,
    durationMinutes: unknown
  ): StartLiveShareResult {
    const id = typeof messageId === "string" ? messageId.trim() : "";
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!id) return { success: false, error: "messageId is required" };
    if (!authorName) return { success: false, error: "author is required" };
    if (!isValidCoordinates({ lat: latitude, lng: longitude })) {
      return { success: false, error: "Invalid coordinates" };
    }
    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes < MIN_LIVE_SHARE_MINUTES || minutes > MAX_LIVE_SHARE_MINUTES) {
      return { success: false, error: `durationMinutes must be between ${MIN_LIVE_SHARE_MINUTES} and ${MAX_LIVE_SHARE_MINUTES}` };
    }

    const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
    this.shares.set(id, { author: authorName, latitude: latitude as number, longitude: longitude as number, expiresAt });
    return { success: true, expiresAt };
  }

  update(messageId: string, author: string, latitude: unknown, longitude: unknown): UpdateLiveShareResult {
    const share = this.shares.get(messageId);
    if (!share) {
      return { success: false, error: "No active live location share for this message" };
    }
    if (share.author !== author) {
      return { success: false, error: "Only the original sharer can update this location" };
    }
    if (new Date(share.expiresAt).getTime() <= Date.now()) {
      return { success: false, error: "This live location share has ended" };
    }
    if (!isValidCoordinates({ lat: latitude, lng: longitude })) {
      return { success: false, error: "Invalid coordinates" };
    }

    share.latitude = latitude as number;
    share.longitude = longitude as number;
    return { success: true, latitude: share.latitude, longitude: share.longitude };
  }

  get(messageId: string): LiveLocationShare | undefined {
    return this.shares.get(messageId);
  }

  isActive(messageId: string): boolean {
    const share = this.shares.get(messageId);
    if (!share) return false;
    return new Date(share.expiresAt).getTime() > Date.now();
  }
}
