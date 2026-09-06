import { createHash } from "crypto";

const MIN_PHONE_DIGITS = 7;

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function hashPhone(raw: string): string {
  return createHash("sha256").update(normalizePhone(raw)).digest("hex");
}

export type RegisterPhoneResult = { success: true } | { success: false; error: string };

/**
 * "Block phone contacts" without a real accounts/phone-verification system yet:
 * an author can self-declare a phone number (same trust-boundary limitation as
 * every other author-scoped endpoint pending real auth), and any other author
 * can submit their phone contact list to find + block matches. Phone numbers
 * are never stored in plaintext — only a normalized SHA-256 hash — so the
 * contact-list upload can't be used to harvest raw numbers from this store.
 */
export class ContactBlockStore {
  private phoneHashByAuthor = new Map<string, string>();
  private authorsByPhoneHash = new Map<string, Set<string>>();

  registerPhone(author: unknown, phoneNumber: unknown): RegisterPhoneResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const phone = typeof phoneNumber === "string" ? phoneNumber : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (normalizePhone(phone).length < MIN_PHONE_DIGITS) {
      return { success: false, error: "phoneNumber must have at least 7 digits" };
    }

    const hash = hashPhone(phone);
    const previousHash = this.phoneHashByAuthor.get(authorName);
    if (previousHash) {
      this.authorsByPhoneHash.get(previousHash)?.delete(authorName);
    }
    this.phoneHashByAuthor.set(authorName, hash);
    const authors = this.authorsByPhoneHash.get(hash) ?? new Set<string>();
    authors.add(authorName);
    this.authorsByPhoneHash.set(hash, authors);

    return { success: true };
  }

  /** Returns the other authors whose registered phone matches one of the given contact numbers. */
  findMatchingAuthors(author: string, phoneNumbers: unknown): string[] {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!Array.isArray(phoneNumbers)) return [];

    const matches = new Set<string>();
    for (const raw of phoneNumbers) {
      if (typeof raw !== "string") continue;
      const hash = hashPhone(raw);
      const authors = this.authorsByPhoneHash.get(hash);
      if (!authors) continue;
      for (const matched of authors) {
        if (matched !== authorName) matches.add(matched);
      }
    }
    return Array.from(matches);
  }
}
