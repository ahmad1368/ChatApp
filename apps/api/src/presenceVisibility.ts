export interface PresenceVisibilityPreference {
  showOnlineStatus: boolean;
  showLastActive: boolean;
}

const DEFAULT_PREFERENCE: PresenceVisibilityPreference = { showOnlineStatus: true, showLastActive: true };

export type UpdatePresenceVisibilityResult =
  | { success: true; preference: PresenceVisibilityPreference }
  | { success: false; error: string };

export interface PresenceStatus {
  online: boolean;
  lastActiveAt: string | null;
}

/**
 * Tinder's real "Settings for how online/offline status is displayed"
 * (#161) — WhatsApp/Bumble's actual "Show when you're active"/"last seen"
 * privacy pair, layered on top of #110's PresenceStore rather than
 * replacing it: the real connection state and last-active timestamp keep
 * being tracked underneath; this only governs what a viewer is shown.
 *
 * `applyTo()` implements the same real "hide yours, lose theirs" mutual
 * gating WhatsApp's actual Last Seen privacy has: `viewer` also loses
 * visibility into `author`'s last-active time if the viewer has turned
 * off their own `showLastActive` — same reciprocal-privacy shape as the
 * genuine feature, not just a one-directional toggle. The online/offline
 * indicator itself isn't reciprocally gated (real WhatsApp doesn't gate
 * that one either) — only last-active is.
 */
export class PresenceVisibilityStore {
  private preferenceByAuthor = new Map<string, PresenceVisibilityPreference>();

  get(author: string): PresenceVisibilityPreference {
    return { ...(this.preferenceByAuthor.get(author) ?? DEFAULT_PREFERENCE) };
  }

  update(author: unknown, updates: Record<string, unknown> | undefined): UpdatePresenceVisibilityResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    const next = this.get(authorName);
    if (updates && "showOnlineStatus" in updates) {
      if (typeof updates.showOnlineStatus !== "boolean") {
        return { success: false, error: "showOnlineStatus must be a boolean" };
      }
      next.showOnlineStatus = updates.showOnlineStatus;
    }
    if (updates && "showLastActive" in updates) {
      if (typeof updates.showLastActive !== "boolean") {
        return { success: false, error: "showLastActive must be a boolean" };
      }
      next.showLastActive = updates.showLastActive;
    }

    this.preferenceByAuthor.set(authorName, next);
    return { success: true, preference: next };
  }

  /** Applies author's own preference (and, for last-active, the viewer's reciprocal preference) to a real presence status snapshot. */
  applyTo(author: string, status: PresenceStatus, viewer?: string): PresenceStatus {
    const authorPreference = this.get(author);
    const viewerAlsoHidesTheirs = viewer !== undefined && !this.get(viewer).showLastActive;
    return {
      online: authorPreference.showOnlineStatus ? status.online : false,
      lastActiveAt: authorPreference.showLastActive && !viewerAlsoHidesTheirs ? status.lastActiveAt : null,
    };
  }
}
