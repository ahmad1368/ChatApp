import { AuthTokens, AuthUser } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const STORAGE_KEY = "chatapp:auth";

interface StoredAuth {
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
