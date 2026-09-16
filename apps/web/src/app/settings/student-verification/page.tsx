"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface VerificationStatus {
  verified: boolean;
  email?: string;
}

/**
 * Raya's real "Student verification system via university (.edu) email"
 * (#305) — a real one-time code sent to an address that must match a
 * `.edu` suffix, mirroring #157's recovery-code UX. This confirms email
 * ownership at a `.edu` domain, not current enrollment at a specific
 * institution (no SheerID/UNiDAYS-style roster check) — disclosed here
 * rather than implied by the "verified" badge.
 */
export default function StudentVerificationSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/student-verification/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => {});
  }, [author]);

  const requestCode = async () => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/student-verification/${encodeURIComponent(author)}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to send verification code");
      setCodeRequested(true);
      setMessage("A verification code was sent to your university email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/student-verification/${encodeURIComponent(author)}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to confirm code");
      setStatus(body);
      setCodeRequested(false);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Student verification</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Verify a university (.edu) email address to show a student badge on your profile. This confirms you own a
        .edu email — it does not confirm current enrollment at a specific school.
      </p>

      {status?.verified ? (
        <p style={{ marginTop: 16 }}>
          <strong>🎓 Verified student</strong>
          {status.email && <><br />{status.email}</>}
        </p>
      ) : (
        <div style={{ marginTop: 16 }}>
          {!codeRequested ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                style={{ flex: 1 }}
              />
              <button onClick={requestCode} disabled={busy || !email.trim()}>
                Send code
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                maxLength={6}
                style={{ flex: 1 }}
              />
              <button onClick={confirmCode} disabled={busy || !code.trim()}>
                Confirm
              </button>
            </div>
          )}
        </div>
      )}

      {message && <p style={{ color: "var(--color-muted)", fontSize: 13, marginTop: 8 }}>{message}</p>}
      {error && <p style={{ color: "var(--color-danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </main>
  );
}
