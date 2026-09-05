const STORAGE_KEY = "chatapp:guestAuthor";

/**
 * Biometric re-authentication only makes sense against a persistent identity —
 * this app has no real accounts yet (pending #21-#27), so we persist a guest
 * author name in localStorage instead of regenerating a random one every load.
 */
export function getOrCreateGuestIdentity(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const generated = `guest-${Math.floor(Math.random() * 100000)}`;
    window.localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch {
    return `guest-${Math.floor(Math.random() * 100000)}`;
  }
}
