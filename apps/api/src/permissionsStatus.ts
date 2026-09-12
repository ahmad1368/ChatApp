export const PERMISSION_TYPES = ["location", "camera", "microphone"] as const;
export type PermissionType = (typeof PERMISSION_TYPES)[number];

export const PERMISSION_STATES = ["granted", "denied", "prompt"] as const;
export type PermissionState = (typeof PERMISSION_STATES)[number];

export type PermissionsSnapshot = Record<PermissionType, PermissionState>;

const DEFAULT_SNAPSHOT: PermissionsSnapshot = { location: "prompt", camera: "prompt", microphone: "prompt" };

export type ReportPermissionResult = { success: true; snapshot: PermissionsSnapshot } | { success: false; error: string };

function isPermissionType(value: unknown): value is PermissionType {
  return typeof value === "string" && (PERMISSION_TYPES as readonly string[]).includes(value);
}

function isPermissionState(value: unknown): value is PermissionState {
  return typeof value === "string" && (PERMISSION_STATES as readonly string[]).includes(value);
}

/**
 * Tinder's real "Manage access permissions (location, camera, microphone
 * access)" (#166). Browser permissions are genuinely queryable client-side
 * via the Permissions API (`navigator.permissions.query`) and requestable
 * via `getUserMedia`/`geolocation.getCurrentPosition` — see
 * apps/web/src/app/PermissionsSettings.tsx — but JavaScript has no way to
 * *revoke* a permission the user already granted; only the browser's own
 * site-settings UI can do that. That's a real platform limitation this
 * feature discloses rather than faking a working "revoke" button for.
 *
 * This store is a server-side mirror of the last status the client
 * actually observed from the browser (never the server's own guess), so
 * other server logic could check "has this author's browser ever
 * reported camera access" without needing a live connection to ask —
 * same "client reports, server records" shape as #39's active-sessions
 * audit trail.
 */
export class PermissionsStatusStore {
  private snapshotByAuthor = new Map<string, PermissionsSnapshot>();

  get(author: string): PermissionsSnapshot {
    return { ...(this.snapshotByAuthor.get(author) ?? DEFAULT_SNAPSHOT) };
  }

  report(author: unknown, type: unknown, state: unknown): ReportPermissionResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!isPermissionType(type)) {
      return { success: false, error: `type must be one of: ${PERMISSION_TYPES.join(", ")}` };
    }
    if (!isPermissionState(state)) {
      return { success: false, error: `state must be one of: ${PERMISSION_STATES.join(", ")}` };
    }

    const next = this.get(authorName);
    next[type] = state;
    this.snapshotByAuthor.set(authorName, next);
    return { success: true, snapshot: next };
  }
}
