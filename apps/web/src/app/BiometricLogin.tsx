"use client";

import { useEffect, useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { AuthUser } from "@chatapp/shared";
import { loadStoredAuth, saveStoredAuth } from "./authClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REMEMBERED_ACCOUNT_KEY = "chatapp:webauthnAccount";

interface RememberedAccount {
  userId: string;
  user: AuthUser;
}

function loadRememberedAccount(): RememberedAccount | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(REMEMBERED_ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as RememberedAccount) : undefined;
  } catch {
    return undefined;
  }
}

function saveRememberedAccount(account: RememberedAccount): void {
  try {
    window.localStorage.setItem(REMEMBERED_ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    // Storage unavailable — registration still succeeded server-side, it
    // just won't be rememberable for a passwordless login on this device.
  }
}

// Registering a new credential requires an authenticated session (gated
// server-side behind requireAuth, same as #26's 2FA setup) — only the
// signed-in owner of an account may enroll a biometric credential for it.
// Logging in happens pre-session, so this device instead remembers which
// account it last registered, the same way a phone remembers whose Face ID
// unlocks a banking app.
export default function BiometricLogin() {
  const [status, setStatus] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<RememberedAccount | undefined>(undefined);

  useEffect(() => {
    setRemembered(loadRememberedAccount());
  }, []);

  const auth = loadStoredAuth();

  const register = async () => {
    if (!auth) {
      setStatus("Sign in first to enable biometric login.");
      return;
    }
    setStatus(null);
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${auth.tokens.accessToken}` };
    try {
      const optionsRes = await fetch(`${API_URL}/api/auth/webauthn/register/options`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ username: auth.user.displayName }),
      });
      if (!optionsRes.ok) throw new Error("Could not start registration");
      const options = await optionsRes.json();
      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch(`${API_URL}/api/auth/webauthn/register/verify`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ response: attestation }),
      });
      if (!verifyRes.ok) throw new Error("Could not verify the new credential");

      const account: RememberedAccount = { userId: auth.user.id, user: auth.user };
      saveRememberedAccount(account);
      setRemembered(account);
      setStatus("Face ID / fingerprint login enabled on this device.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Registration failed or was cancelled");
    }
  };

  const login = async () => {
    if (!remembered) {
      setStatus("No biometric account registered on this device yet.");
      return;
    }
    setStatus(null);
    try {
      const optionsRes = await fetch(`${API_URL}/api/auth/webauthn/login/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: remembered.userId }),
      });
      if (!optionsRes.ok) throw new Error("No biometric credential registered for this account");
      const options = await optionsRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch(`${API_URL}/api/auth/webauthn/login/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: remembered.userId, response: assertion }),
      });
      if (!verifyRes.ok) throw new Error("Biometric verification failed");
      const { tokens } = await verifyRes.json();
      saveStoredAuth({ user: remembered.user, tokens });
      setStatus("Signed in with Face ID / fingerprint.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Sign-in failed or was cancelled");
    }
  };

  return (
    <div style={{ maxWidth: 320 }}>
      <h2 style={{ fontSize: 16 }}>Face ID / fingerprint login</h2>
      {auth && (
        <button onClick={register} style={{ padding: 10, marginRight: 8 }}>
          Enable biometric login on this device
        </button>
      )}
      {remembered && (
        <button onClick={login} style={{ padding: 10 }}>
          Sign in with Face ID / fingerprint
        </button>
      )}
      {!auth && !remembered && (
        <p style={{ fontSize: 13, color: "#6b7280" }}>Sign in first, then enable biometric login on this device.</p>
      )}
      {status && <p style={{ fontSize: 13, color: "#6b7280" }}>{status}</p>}
    </div>
  );
}
