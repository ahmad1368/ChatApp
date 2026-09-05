import { AuthTokens, AuthUser } from "@chatapp/shared";

const STORAGE_KEY = "chatapp:auth";

export interface StoredAuth {
  user: AuthUser;
  tokens: AuthTokens;
}

export function loadStoredAuth(): StoredAuth | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : undefined;
  } catch {
    return undefined;
  }
}

export function saveStoredAuth(auth: StoredAuth): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } catch {
    // Storage unavailable — the session just won't persist across reloads.
  }
}

export function clearStoredAuth(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage was never available.
  }
}
