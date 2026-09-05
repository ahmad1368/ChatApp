const STORAGE_KEY = "chatapp:onboardingDraftId";

/** See #39: a stable client-side id, remembered in localStorage, so
 * returning to /onboarding with no params still resumes the same
 * in-progress draft after a closed tab or crash. */
export function getOrCreateDraftId(): string {
  if (typeof window === "undefined") return "server-render-placeholder";

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const created = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}
