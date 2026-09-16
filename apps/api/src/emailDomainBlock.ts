const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, "");
}

export type RegisterEmailResult = { success: true } | { success: false; error: string };

/**
 * Bumble's real "Ability to block a specific email domain" — same
 * self-declared-identity shape as #43's ContactBlockStore (phone
 * numbers): pending a real accounts/email-verification system unifying
 * guest authors with #25's actual account-recovery email, an author
 * self-declares their own email here, and any other author can name a
 * domain (e.g. a workplace's) to sweep-block everyone currently
 * registered under it via the shared BlockStore. Like #43, this only
 * catches authors already registered with a matching domain at the
 * moment of blocking — a new signup at that domain afterward isn't
 * retroactively caught, the same disclosed one-shot-sweep limitation
 * #43's contact-list upload has.
 */
export class EmailDomainBlockStore {
  private domainByAuthor = new Map<string, string>();
  private authorsByDomain = new Map<string, Set<string>>();

  registerEmail(author: unknown, email: unknown): RegisterEmailResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const emailValue = typeof email === "string" ? email.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!EMAIL_PATTERN.test(emailValue)) {
      return { success: false, error: "email must be a valid email address" };
    }

    const domain = extractDomain(emailValue);
    const previousDomain = this.domainByAuthor.get(authorName);
    if (previousDomain) {
      this.authorsByDomain.get(previousDomain)?.delete(authorName);
    }
    this.domainByAuthor.set(authorName, domain);
    const authors = this.authorsByDomain.get(domain) ?? new Set<string>();
    authors.add(authorName);
    this.authorsByDomain.set(domain, authors);

    return { success: true };
  }

  /** Returns the other authors whose registered email domain matches one of the given blocked domains. */
  findMatchingAuthors(author: string, domains: unknown): string[] {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!Array.isArray(domains)) return [];

    const matches = new Set<string>();
    for (const raw of domains) {
      if (typeof raw !== "string") continue;
      const domain = normalizeDomain(raw);
      if (!domain) continue;
      const authors = this.authorsByDomain.get(domain);
      if (!authors) continue;
      for (const matched of authors) {
        if (matched !== authorName) matches.add(matched);
      }
    }
    return Array.from(matches);
  }
}
