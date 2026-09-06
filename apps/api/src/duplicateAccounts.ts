import { createHash } from "crypto";

function hashValue(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface DuplicateAccountStatus {
  flagged: boolean;
  matchedUserIds: string[];
}

/**
 * Duplicate/intrusive-account detection: flags an account that shares a
 * network address or a client-declared device fingerprint with another
 * existing account, the same signal Bumble-style safety systems use to
 * catch someone re-registering after a ban or running multiple accounts.
 * Neither the raw IP nor fingerprint is ever stored — only their SHA-256
 * hashes — matching the phone-hash pattern in contactBlocks.ts. Shared
 * wifi/VPNs/spoofed fingerprints mean this can't prove two accounts are
 * the same person, so it only flags for review rather than blocking
 * sign-in outright.
 */
export class DuplicateAccountStore {
  private userIdsByIpHash = new Map<string, Set<string>>();
  private userIdsByDeviceHash = new Map<string, Set<string>>();
  private matchedUserIdsByUserId = new Map<string, Set<string>>();

  private link(userId: string, hash: string, index: Map<string, Set<string>>): void {
    const existing = index.get(hash) ?? new Set<string>();
    for (const otherUserId of existing) {
      if (otherUserId === userId) continue;
      const mine = this.matchedUserIdsByUserId.get(userId) ?? new Set<string>();
      mine.add(otherUserId);
      this.matchedUserIdsByUserId.set(userId, mine);

      const theirs = this.matchedUserIdsByUserId.get(otherUserId) ?? new Set<string>();
      theirs.add(userId);
      this.matchedUserIdsByUserId.set(otherUserId, theirs);
    }
    existing.add(userId);
    index.set(hash, existing);
  }

  /** Called on every sign-in/sign-up, not just the first — idempotent, since the sets just dedupe. */
  recordSignIn(userId: unknown, ipAddress: unknown, deviceFingerprint: unknown): void {
    const id = typeof userId === "string" ? userId.trim() : "";
    if (!id) return;

    if (typeof ipAddress === "string" && ipAddress) {
      this.link(id, hashValue(ipAddress), this.userIdsByIpHash);
    }
    if (typeof deviceFingerprint === "string" && deviceFingerprint) {
      this.link(id, hashValue(deviceFingerprint), this.userIdsByDeviceHash);
    }
  }

  getStatus(userId: string): DuplicateAccountStatus {
    const matched = this.matchedUserIdsByUserId.get(userId);
    return { flagged: !!matched && matched.size > 0, matchedUserIds: matched ? Array.from(matched) : [] };
  }
}
