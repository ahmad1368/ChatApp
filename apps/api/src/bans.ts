export const BAN_TYPES = ["temporary", "permanent"] as const;
export type BanType = (typeof BAN_TYPES)[number];

export const BAN_MODES = ["banned", "shadowbanned"] as const;
export type BanMode = (typeof BAN_MODES)[number];

const MAX_DURATION_HOURS = 24 * 365;

interface BanRecord {
  mode: BanMode;
  type?: BanType;
  reason: string;
  bannedBy: string;
  bannedAt: string;
  expiresAt: string | null;
  // Insertion order, used only to break ties when two bans land in the
  // same millisecond — bannedAt alone isn't precise enough to order them.
  sequence: number;
}

export interface BanQueueEntry {
  userId: string;
  mode: BanMode;
  type?: BanType;
  reason: string;
  bannedBy: string;
  bannedAt: string;
  expiresAt: string | null;
}

export type ApplyBanResult = { success: true; entry: BanQueueEntry } | { success: false; error: string };

function isBanMode(value: unknown): value is BanMode {
  return value === "banned" || value === "shadowbanned";
}

function isBanType(value: unknown): value is BanType {
  return value === "temporary" || value === "permanent";
}

/**
 * Bumble's real "Ban / Shadowban" (#175): builds on #171-174's admin-key
 * gate. A "banned" account is hard-blocked from swiping and sending
 * messages (a visible consequence) and disappears from discovery. A
 * "shadowbanned" account keeps using the app normally with no visible
 * error — it only disappears from other people's discovery pool, same
 * "silently hide from everyone" mechanism #164's SnoozeAccountStore
 * already uses for a self-initiated pause, reused here for an
 * admin-initiated one. This app has no per-conversation delivery
 * pipeline it can selectively suppress without changing message:send's
 * broadcast for every user, so shadowban intentionally doesn't touch
 * chat delivery — that's the honestly-scoped boundary, not a fabricated
 * one, kept consistent with #111 (VanishMode)/#164 (SnoozeAccount) only
 * ever acting at the discovery layer.
 */
export class BanStore {
  private bansByUserId = new Map<string, BanRecord>();
  private nextSequence = 0;

  private isExpired(record: BanRecord): boolean {
    return record.expiresAt !== null && Date.parse(record.expiresAt) <= Date.now();
  }

  private getActiveRecord(userId: string): BanRecord | undefined {
    const record = this.bansByUserId.get(userId);
    if (!record) return undefined;
    if (this.isExpired(record)) {
      this.bansByUserId.delete(userId);
      return undefined;
    }
    return record;
  }

  apply(
    userId: unknown,
    mode: unknown,
    reason: unknown,
    bannedBy: unknown,
    type?: unknown,
    durationHours?: unknown
  ): ApplyBanResult {
    const id = typeof userId === "string" ? userId.trim() : "";
    const reasonText = typeof reason === "string" ? reason.trim() : "";
    const bannedByName = typeof bannedBy === "string" ? bannedBy.trim() : "";
    if (!id) return { success: false, error: "userId is required" };
    if (!isBanMode(mode)) return { success: false, error: "mode must be 'banned' or 'shadowbanned'" };
    if (!reasonText) return { success: false, error: "reason is required" };
    if (!bannedByName) return { success: false, error: "bannedBy is required" };

    let expiresAt: string | null = null;
    let banType: BanType | undefined;
    if (mode === "banned") {
      if (!isBanType(type)) return { success: false, error: "type must be 'temporary' or 'permanent'" };
      banType = type;
      if (type === "temporary") {
        const hours = Number(durationHours);
        if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_DURATION_HOURS) {
          return { success: false, error: `durationHours must be a number between 1 and ${MAX_DURATION_HOURS}` };
        }
        expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      }
    }

    const record: BanRecord = {
      mode,
      type: banType,
      reason: reasonText,
      bannedBy: bannedByName,
      bannedAt: new Date().toISOString(),
      expiresAt,
      sequence: this.nextSequence++,
    };
    this.bansByUserId.set(id, record);
    return { success: true, entry: toQueueEntry(id, record) };
  }

  lift(userId: string): boolean {
    return this.bansByUserId.delete(userId);
  }

  isBanned(userId: string): boolean {
    return this.getActiveRecord(userId)?.mode === "banned";
  }

  isShadowbanned(userId: string): boolean {
    return this.getActiveRecord(userId)?.mode === "shadowbanned";
  }

  getStatus(userId: string): BanQueueEntry | null {
    const record = this.getActiveRecord(userId);
    return record ? toQueueEntry(userId, record) : null;
  }

  /** Every currently-active ban/shadowban, most recently issued first — the admin audit queue for #175. */
  getActiveBans(): BanQueueEntry[] {
    const active: Array<[string, BanRecord]> = [];
    for (const [userId, record] of this.bansByUserId) {
      if (this.isExpired(record)) continue;
      active.push([userId, record]);
    }
    return active.sort(([, a], [, b]) => b.sequence - a.sequence).map(([userId, record]) => toQueueEntry(userId, record));
  }
}

function toQueueEntry(userId: string, record: BanRecord): BanQueueEntry {
  const { sequence: _sequence, ...rest } = record;
  return { userId, ...rest };
}
