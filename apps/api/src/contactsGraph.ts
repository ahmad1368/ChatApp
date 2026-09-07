import { hashPhone } from "./contactBlocks";

export type UploadContactsResult = { success: true; contactCount: number } | { success: false; error: string };

/**
 * Tinder's real Facebook-friends-based "X mutual friends" trust signal
 * (#114) — reimagined here via #17's phone-contact hashing (this app has
 * no Facebook Graph API integration) rather than a social-graph import:
 * two authors who each upload their phone contacts share a "mutual
 * contact" for every phone number hash that appears in both lists. Same
 * privacy-preserving hash-only storage as ContactBlockStore (raw numbers
 * are never persisted or compared in plaintext), but a different shape —
 * a full per-author contact *set* for overlap counting, rather than one
 * self-registered number for reverse lookup — so it's its own store
 * rather than extending ContactBlockStore.
 */
export class ContactsGraphStore {
  private contactHashesByAuthor = new Map<string, Set<string>>();

  uploadContacts(author: unknown, phoneNumbers: unknown): UploadContactsResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!Array.isArray(phoneNumbers)) {
      return { success: false, error: "phoneNumbers must be an array" };
    }

    const hashes = new Set<string>();
    for (const raw of phoneNumbers) {
      if (typeof raw !== "string" || !raw.trim()) continue;
      hashes.add(hashPhone(raw));
    }
    this.contactHashesByAuthor.set(authorName, hashes);
    return { success: true, contactCount: hashes.size };
  }

  /** Count of contact-list phone hashes appearing in both authors' uploaded lists. */
  getSharedContactCount(a: string, b: string): number {
    const contactsA = this.contactHashesByAuthor.get(a);
    const contactsB = this.contactHashesByAuthor.get(b);
    if (!contactsA || !contactsB) return 0;
    let count = 0;
    for (const hash of contactsA) {
      if (contactsB.has(hash)) count++;
    }
    return count;
  }
}
