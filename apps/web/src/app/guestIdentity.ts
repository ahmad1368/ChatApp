const STORAGE_KEY = "chatapp:guestAuthor";
const SAVED_IDENTITIES_KEY = "chatapp:guestAuthors";

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

/**
 * Tinder's real "Ability to add a second account and switch quickly"
 * (#291) — this app has no real multi-account auth system yet (same
 * guest-identity vs. real-account divide as #21-28's onboarding), so
 * "account" here means a second saved guest identity on this device,
 * with quick switching between them. Every page reads its author via
 * `useState(() => getOrCreateGuestIdentity())` at mount, so a full
 * `window.location.reload()` after switching the active identity in
 * localStorage — not a broader in-place global-state refactor — is the
 * one honest way to make every already-loaded page consistently reflect
 * the switch without silently leaving some components on the old identity.
 */
export function getSavedIdentities(): string[] {
  try {
    const active = getOrCreateGuestIdentity();
    const raw = window.localStorage.getItem(SAVED_IDENTITIES_KEY);
    const saved: string[] = raw ? JSON.parse(raw) : [];
    return Array.from(new Set([active, ...saved]));
  } catch {
    return [getOrCreateGuestIdentity()];
  }
}

function saveIdentityList(identities: string[]): void {
  try {
    window.localStorage.setItem(SAVED_IDENTITIES_KEY, JSON.stringify(identities));
  } catch {
    // No persistent storage available — the switch below still works for
    // this page load via STORAGE_KEY, it just won't be remembered.
  }
}

/** Generates a brand-new guest identity, saves it alongside existing ones, and switches to it. Returns the new identity. */
export function addAndSwitchToNewIdentity(): string {
  const generated = `guest-${Math.floor(Math.random() * 100000)}`;
  const identities = Array.from(new Set([...getSavedIdentities(), generated]));
  saveIdentityList(identities);
  try {
    window.localStorage.setItem(STORAGE_KEY, generated);
  } catch {
    // Best-effort — see saveIdentityList().
  }
  return generated;
}

/** Switches the active identity to an already-saved one. */
export function switchToIdentity(identity: string): void {
  saveIdentityList(getSavedIdentities());
  try {
    window.localStorage.setItem(STORAGE_KEY, identity);
  } catch {
    // Best-effort — see saveIdentityList().
  }
}
