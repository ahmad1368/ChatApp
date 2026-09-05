const STORAGE_KEY = "chatapp:onboardingDraftId";

/**
 * Addresses the actual gap in "save progress on sudden exit": the server
 * already persists every submitted step (see OnboardingStore), but without
 * a stable client-side id to ask for, a closed tab/crashed browser has no
 * way to find its way back to that record — a query param isn't something
 * anyone bookmarks or remembers. This generates one once and remembers it
 * in localStorage, so returning to /onboarding with no params still
 * resumes the same in-progress draft.
 */
export function getOrCreateDraftId(): string {
  if (typeof window === "undefined") return "server-render-placeholder";

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const created = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // Storage unavailable (private browsing, disabled site data) — fall
    // back to a per-load id. Progress still saves server-side per request,
    // it just won't survive a reload without storage to remember the id.
    return crypto.randomUUID();
  }
}
