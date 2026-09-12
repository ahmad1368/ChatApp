export const CURRENT_TERMS_VERSION = 1;

export interface TermsAcceptance {
  version: number;
  acceptedAt: string;
}

export type RecordAcceptanceResult = { success: true; acceptance: TermsAcceptance } | { success: false; error: string };

/**
 * Feeld's real "Direct links to terms, privacy policy and support"
 * (#169). The actual terms/privacy-policy/support content is static
 * (see apps/web/src/app/terms, /privacy-policy, /support) — this store
 * is the one genuinely stateful piece: recording that an author has
 * viewed the current version of the Terms of Service, so a future terms
 * update (bumping CURRENT_TERMS_VERSION) can tell who's only agreed to
 * an older one. Visiting the terms page counts as acceptance — this app
 * has no account-creation gate to require explicit re-consent at, same
 * scoping call as #21-28's guest-identity-only auth.
 */
export class TermsAcceptanceStore {
  private acceptanceByAuthor = new Map<string, TermsAcceptance>();

  get(author: string): TermsAcceptance | null {
    return this.acceptanceByAuthor.get(author) ?? null;
  }

  recordAcceptance(author: unknown): RecordAcceptanceResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    const acceptance: TermsAcceptance = { version: CURRENT_TERMS_VERSION, acceptedAt: new Date().toISOString() };
    this.acceptanceByAuthor.set(authorName, acceptance);
    return { success: true, acceptance };
  }

  /** Whether this author has accepted the current terms version — false for a stale acceptance of an older one. */
  hasAcceptedCurrent(author: string): boolean {
    return this.get(author)?.version === CURRENT_TERMS_VERSION;
  }
}
