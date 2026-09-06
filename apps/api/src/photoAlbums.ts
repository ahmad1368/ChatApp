export const ALBUM_ACCESS_LEVELS = ["public", "private", "requestAccess"] as const;
export type AlbumAccessLevel = (typeof ALBUM_ACCESS_LEVELS)[number];

export type SetAccessLevelResult = { success: true; accessLevel: AlbumAccessLevel } | { success: false; error: string };
export type RequestAccessResult = { success: true } | { success: false; error: string };
export type RespondToRequestResult = { success: true } | { success: false; error: string };

function isAccessLevel(value: unknown): value is AlbumAccessLevel {
  return typeof value === "string" && (ALBUM_ACCESS_LEVELS as readonly string[]).includes(value);
}

/**
 * Bumble's real "Private Album" control, generalized here to three tiers
 * (public / private / request-access) rather than a binary lock. Keyed by
 * the chat `author` identity, same as PhotoStore whose photos this gates —
 * chat identity and the #21-#25 account system aren't wired together yet,
 * so this is the same self-declared trust boundary as Block/Report/etc.
 */
export class PhotoAlbumStore {
  private accessLevelByOwner = new Map<string, AlbumAccessLevel>();
  private pendingRequestsByOwner = new Map<string, Set<string>>();
  private approvedViewersByOwner = new Map<string, Set<string>>();

  getAccessLevel(owner: string): AlbumAccessLevel {
    return this.accessLevelByOwner.get(owner) ?? "public";
  }

  setAccessLevel(owner: unknown, accessLevel: unknown): SetAccessLevelResult {
    const ownerName = typeof owner === "string" ? owner.trim() : "";
    if (!ownerName) return { success: false, error: "owner is required" };
    if (!isAccessLevel(accessLevel)) {
      return { success: false, error: `accessLevel must be one of: ${ALBUM_ACCESS_LEVELS.join(", ")}` };
    }
    this.accessLevelByOwner.set(ownerName, accessLevel);
    return { success: true, accessLevel };
  }

  requestAccess(requester: unknown, owner: unknown): RequestAccessResult {
    const requesterName = typeof requester === "string" ? requester.trim() : "";
    const ownerName = typeof owner === "string" ? owner.trim() : "";
    if (!requesterName) return { success: false, error: "requester is required" };
    if (!ownerName) return { success: false, error: "owner is required" };
    if (requesterName === ownerName) return { success: false, error: "You already have access to your own album" };
    if (this.getAccessLevel(ownerName) !== "requestAccess") {
      return { success: false, error: "This album isn't set to request-access mode" };
    }

    const pending = this.pendingRequestsByOwner.get(ownerName) ?? new Set<string>();
    pending.add(requesterName);
    this.pendingRequestsByOwner.set(ownerName, pending);
    return { success: true };
  }

  listPendingRequests(owner: string): string[] {
    return Array.from(this.pendingRequestsByOwner.get(owner) ?? []);
  }

  respondToRequest(owner: unknown, requester: unknown, approve: unknown): RespondToRequestResult {
    const ownerName = typeof owner === "string" ? owner.trim() : "";
    const requesterName = typeof requester === "string" ? requester.trim() : "";
    if (!ownerName || !requesterName) return { success: false, error: "owner and requester are required" };

    const pending = this.pendingRequestsByOwner.get(ownerName);
    if (!pending?.has(requesterName)) return { success: false, error: "No pending request from this requester" };

    pending.delete(requesterName);
    if (approve === true) {
      const approved = this.approvedViewersByOwner.get(ownerName) ?? new Set<string>();
      approved.add(requesterName);
      this.approvedViewersByOwner.set(ownerName, approved);
    }
    return { success: true };
  }

  /** The gate PhotoStore's serve endpoint calls before returning a photo. */
  canView(viewer: string, owner: string): boolean {
    if (viewer === owner) return true;
    const level = this.getAccessLevel(owner);
    if (level === "public") return true;
    if (level === "private") return false;
    return this.approvedViewersByOwner.get(owner)?.has(viewer) ?? false;
  }
}
