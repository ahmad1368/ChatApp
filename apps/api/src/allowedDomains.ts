const MAX_DOMAIN_LENGTH = 200;

export type AddDomainResult = { success: true; origin: string } | { success: false; error: string };

function normalizeOrigin(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function isValidOrigin(origin: string): boolean {
  if (!origin || origin.length > MAX_DOMAIN_LENGTH) return false;
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin === origin;
  } catch {
    return false;
  }
}

/**
 * Bumble's real "Manage domains and website access" (#184) — a real
 * CORS allowlist an admin controls at runtime, gated the same admin-key
 * way as #171-183, rather than a fabricated DNS/hosting management
 * console this environment has no infrastructure for (it doesn't own or
 * serve any custom domains). Enforced in server.ts's cors() origin
 * check. An unconfigured (empty) allowlist means "allow every origin" —
 * this app's existing default before #184 — so adding the first entry
 * is what actually starts restricting access, not an implicit lockout.
 */
export class AllowedDomainStore {
  private origins = new Set<string>();

  add(origin: unknown): AddDomainResult {
    const normalized = normalizeOrigin(origin);
    if (!isValidOrigin(normalized)) {
      return { success: false, error: "origin must be a valid http(s) URL with no path, e.g. https://example.com" };
    }
    this.origins.add(normalized);
    return { success: true, origin: normalized };
  }

  remove(origin: string): boolean {
    return this.origins.delete(normalizeOrigin(origin));
  }

  list(): string[] {
    return [...this.origins];
  }

  /** The real enforcement check — see server.ts's cors() origin callback. */
  isAllowed(origin: string): boolean {
    if (this.origins.size === 0) return true;
    return this.origins.has(normalizeOrigin(origin));
  }
}
