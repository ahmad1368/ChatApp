export type PublishKeyResult = { success: true } | { success: false; error: string };

/**
 * Feeld's real optional end-to-end encrypted chat (#149) — the server's
 * only role is relaying each user's ECDH public key (a JWK) so two
 * clients can derive a shared AES-GCM key entirely on-device via the Web
 * Crypto API (see apps/web/src/app/e2ee.ts). The server never sees a
 * private key, and once encryption is on for a conversation it never
 * sees plaintext either — message:send in server.ts just relays the
 * ciphertext it's handed, the same "opaque blob" treatment as any other
 * uploaded media URL. Its own dependency-free store, same shape as
 * reports.ts/blocks.ts — a public-key directory has nothing to do with
 * chat history or any other subsystem.
 */
export class PublicKeyStore {
  private keysByAuthor = new Map<string, unknown>();

  publish(author: unknown, publicKeyJwk: unknown): PublishKeyResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!publicKeyJwk || typeof publicKeyJwk !== "object") {
      return { success: false, error: "publicKeyJwk is required" };
    }
    this.keysByAuthor.set(authorName, publicKeyJwk);
    return { success: true };
  }

  get(author: string): unknown | undefined {
    return this.keysByAuthor.get(author);
  }
}
