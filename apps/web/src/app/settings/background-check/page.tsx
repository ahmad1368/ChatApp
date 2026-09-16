"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface BackgroundCheckRecord {
  status: "notRequested" | "invited" | "pending" | "clear" | "consider";
  candidateId: string | null;
  invitationUrl: string | null;
  requestedAt: string | null;
}

const STATUS_LABEL: Record<BackgroundCheckRecord["status"], string> = {
  notRequested: "Not requested",
  invited: "Invitation sent — complete it on Checkr's site",
  pending: "Check in progress",
  clear: "✅ Clear — no criminal record found",
  consider: "Flagged for review",
};

/**
 * Raya's real "Ability to verify a certificate of no criminal record
 * (optional)" (#295) — a real Checkr integration (see backgroundCheck.ts).
 * This environment has no CHECKR_API_KEY configured, so the 503 case is
 * disclosed the same way AiAvatarEditor.tsx discloses its own missing
 * Stability AI credentials, rather than hiding the feature.
 */
export default function BackgroundCheckSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [email, setEmail] = useState("");
  const [record, setRecord] = useState<BackgroundCheckRecord | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/background-check/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setRecord(body))
      .catch(() => {});
  }, [author]);

  const requestCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotConfigured(false);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/background-check/${encodeURIComponent(author)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to request a background check");
      }
      setRecord(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request a background check");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setError(null);
    setNotConfigured(false);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/background-check/${encodeURIComponent(author)}/refresh`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to refresh status");
      }
      setRecord(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Criminal record check (optional)</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Get a verified badge by completing a real background check through Checkr. This is entirely optional and
        only shows a pass/fail result — no sensitive details are shared with other users.
      </p>

      {record?.status === "notRequested" || !record ? (
        <form onSubmit={requestCheck} style={{ marginTop: 16 }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
          <button type="submit" disabled={busy} style={{ marginTop: 8 }}>
            Request background check
          </button>
        </form>
      ) : (
        <div style={{ marginTop: 16 }}>
          <p>
            <strong>Status:</strong> {STATUS_LABEL[record.status]}
          </p>
          {record.invitationUrl && record.status === "invited" && (
            <p>
              <a href={record.invitationUrl} target="_blank" rel="noreferrer">
                Complete your check on Checkr &rarr;
              </a>
            </p>
          )}
          <button onClick={refresh} disabled={busy}>
            Refresh status
          </button>
        </div>
      )}

      {notConfigured && (
        <p style={{ color: "var(--color-muted)", fontSize: 12, marginTop: 8 }}>
          Background check verification is not configured for this deployment.
        </p>
      )}
      {error && <p style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </main>
  );
}
