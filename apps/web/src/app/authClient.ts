import { AuthTokens, AuthUser } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
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

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function requestOtp(phoneNumber: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/signup/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
}

export async function verifyOtp(phoneNumber: string, code: string): Promise<StoredAuth> {
  const res = await fetch(`${API_URL}/api/auth/signup/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber, code }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const auth: StoredAuth = await res.json();
  saveStoredAuth(auth);
  return auth;
}

/**
 * The access token backing an authenticated page like /onboarding is only
 * good for 15 minutes (see TokenService) — closing the tab overnight and
 * coming back is exactly the "sudden exit" scenario #39 asks to survive,
 * and a stale access token would otherwise 401 on return. Rotates the
 * refresh token on use and persists the result; clears the stored session
 * entirely if the refresh token itself is invalid/expired (they'll need to
 * sign in again — there's nothing left to resume with).
 */
export async function refreshAccessToken(): Promise<string | undefined> {
  const auth = loadStoredAuth();
  if (!auth) return undefined;

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: auth.tokens.refreshToken }),
  });
  if (!res.ok) {
    clearStoredAuth();
    return undefined;
  }
  const { tokens } = await res.json();
  saveStoredAuth({ user: auth.user, tokens });
  return tokens.accessToken;
}

/**
 * fetch() with the current access token, retried once with a refreshed
 * token if the server says it expired. Callers still get a plain Response
 * back (401 if refresh also failed) rather than this throwing, so existing
 * res.ok / res.json() handling keeps working unchanged.
 */
export async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const auth = loadStoredAuth();
  const withAuthHeader = (accessToken: string): RequestInit => ({
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
  });

  if (!auth) return fetch(url, init);

  const res = await fetch(url, withAuthHeader(auth.tokens.accessToken));
  if (res.status !== 401) return res;

  const refreshed = await refreshAccessToken();
  if (!refreshed) return res;
  return fetch(url, withAuthHeader(refreshed));
}
