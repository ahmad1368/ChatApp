"use client";

import { useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Same known limitation as #26's 2FA: these calls trust a client-supplied
// userId rather than a verified access token, since no auth PR (#21-#25) is
// merged yet. Registration must be gated behind a real session before this
// ships — see the SECURITY NOTE in apps/api/src/server.ts.
export default function BiometricLogin({ userId }: { userId: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const register = async () => {
    setStatus(null);
    try {
      const optionsRes = await fetch(`${API_URL}/api/auth/webauthn/register/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, username: userId }),
      });
      const options = await optionsRes.json();
      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch(`${API_URL}/api/auth/webauthn/register/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, response: attestation }),
      });
      if (!verifyRes.ok) throw new Error("Could not verify the new credential");
      setRegistered(true);
      setStatus("Face ID / fingerprint login enabled.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Registration failed or was cancelled");
    }
  };

  const login = async () => {
    setStatus(null);
    try {
      const optionsRes = await fetch(`${API_URL}/api/auth/webauthn/login/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!optionsRes.ok) throw new Error("No biometric credential registered for this user");
      const options = await optionsRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch(`${API_URL}/api/auth/webauthn/login/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, response: assertion }),
      });
      if (!verifyRes.ok) throw new Error("Biometric verification failed");
      setStatus("Signed in with Face ID / fingerprint.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Sign-in failed or was cancelled");
    }
  };

  return (
    <div style={{ maxWidth: 320 }}>
      <h2 style={{ fontSize: 16 }}>Face ID / fingerprint login</h2>
      {!registered && (
        <button onClick={register} style={{ padding: 10, marginRight: 8 }}>
          Enable biometric login
        </button>
      )}
      <button onClick={login} style={{ padding: 10 }}>
        Sign in with Face ID / fingerprint
      </button>
      {status && <p style={{ fontSize: 13, color: "#6b7280" }}>{status}</p>}
    </div>
  );
}
