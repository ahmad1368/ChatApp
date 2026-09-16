"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Setting to not receive picture messages from strangers"
 * (#281) — see strangerPictureBlock.ts for why this is opt-in and applies
 * only to non-matches (this app's chat is one shared room, not per-match
 * DM threads, so "stranger" here means anyone who isn't one of your
 * matches).
 */
export default function StrangerPicturesSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/stranger-picture-block/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setEnabled(Boolean(body.enabled)))
      .catch(() => {});
  }, [author]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setStatus(null);
    fetch(`${API_URL}/api/stranger-picture-block/${encodeURIComponent(author)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("Saved.");
      })
      .catch(() => setStatus("Failed to save — please try again."));
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Picture messages</h1>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, marginTop: 16 }}>
        <input type="checkbox" checked={enabled} onChange={toggle} style={{ marginTop: 3 }} />
        <span>
          <strong>Don&apos;t receive picture messages from strangers</strong>
          <br />
          <span style={{ color: "var(--color-muted)", fontSize: 13 }}>
            Picture messages (including view-once photos) from anyone who isn&apos;t one of your matches will be
            hidden. Text messages from strangers are unaffected.
          </span>
        </span>
      </label>

      {status && <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 12 }}>{status}</p>}
    </main>
  );
}
