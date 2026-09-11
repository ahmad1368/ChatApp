"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Weekly digest emails" (#157) — opt in with an email
 * (keyed to the same guest chat identity push subscriptions use, not the
 * separate account-auth email system) to get a weekly summary of likes
 * and matches. See weeklyDigest.ts for the actual send (logged
 * server-side — no real email provider credentials in this environment).
 */
export default function WeeklyDigestSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [subscribedEmail, setSubscribedEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/weekly-digest-email/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setSubscribedEmail(body.email ?? null))
      .catch(() => {});
  }, [author]);

  const subscribe = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/weekly-digest-email/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to subscribe");
      setSubscribedEmail(body.email);
      setEmail("");
      setStatus("Subscribed!");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to subscribe");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/weekly-digest-email/${encodeURIComponent(author)}`, { method: "DELETE" });
      setSubscribedEmail(null);
      setStatus("Unsubscribed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Weekly digest emails</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Get a weekly email summarizing your likes and matches.
      </p>

      {subscribedEmail ? (
        <div style={{ marginTop: 16 }}>
          <p>
            Subscribed as <strong>{subscribedEmail}</strong>
          </p>
          <button onClick={unsubscribe} disabled={busy}>
            Unsubscribe
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: "100%" }}
          />
          <button onClick={subscribe} disabled={busy || !email.trim()} style={{ marginTop: 8 }}>
            Subscribe
          </button>
        </div>
      )}
      {status && <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 12 }}>{status}</p>}
    </main>
  );
}
