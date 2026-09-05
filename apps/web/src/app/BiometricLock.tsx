"use client";

import { useEffect, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type LockState = "checking" | "unlocked" | "locked" | "offer-enroll";

export default function BiometricLock({ author, children }: { author: string; children: React.ReactNode }) {
  const [state, setState] = useState<LockState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checkStatus = () => {
    fetch(`${API_URL}/api/webauthn/status/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setState(body.registered ? "locked" : "offer-enroll"))
      .catch(() => setState("offer-enroll"));
  };

  useEffect(() => {
    checkStatus();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkStatus();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enroll = async () => {
    setError(null);
    setBusy(true);
    try {
      const optionsRes = await fetch(`${API_URL}/api/webauthn/registration/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author }),
      });
      const options = await optionsRes.json();
      const attestation = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch(`${API_URL}/api/webauthn/registration/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, response: attestation }),
      });
      if (!verifyRes.ok) throw new Error((await verifyRes.json()).error ?? "Enrollment failed");
      setState("unlocked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  const reauthenticate = async () => {
    setError(null);
    setBusy(true);
    try {
      const optionsRes = await fetch(`${API_URL}/api/webauthn/authentication/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author }),
      });
      const options = await optionsRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch(`${API_URL}/api/webauthn/authentication/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, response: assertion }),
      });
      if (!verifyRes.ok) throw new Error((await verifyRes.json()).error ?? "Re-authentication failed");
      setState("unlocked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-authentication failed");
    } finally {
      setBusy(false);
    }
  };

  if (state === "checking") return null;

  if (state === "unlocked") {
    return <>{children}</>;
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif", textAlign: "center" }}>
      <p style={{ fontSize: 40 }}>🔒</p>
      {state === "locked" && (
        <>
          <h1>Verify it&apos;s you</h1>
          <p style={{ color: "#666" }}>Use your device&apos;s biometrics to re-enter ChatApp.</p>
          <button onClick={reauthenticate} disabled={busy}>
            {busy ? "Verifying…" : "Unlock with biometrics"}
          </button>
        </>
      )}
      {state === "offer-enroll" && (
        <>
          <h1>Enable biometric app lock</h1>
          <p style={{ color: "#666" }}>
            Require Face ID / Touch ID / Windows Hello to re-open ChatApp each time you return.
          </p>
          <button onClick={enroll} disabled={busy}>
            {busy ? "Setting up…" : "Enable biometric lock"}
          </button>
          <p>
            <button onClick={() => setState("unlocked")} style={{ fontSize: 12 }}>
              Skip for now
            </button>
          </p>
        </>
      )}
      {error && <p style={{ color: "#b00020" }}>{error}</p>}
    </main>
  );
}
