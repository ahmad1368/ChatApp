"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Bumble's real Snooze Mode (#164): "hide profile without deleting the
 * account" — a full pause, distinct from #111's Vanish Mode above it on
 * this page. Snoozed hides you from *everyone* in discovery (no
 * "already liked me" exception) and pauses your own ability to swipe on
 * new candidates, but never touches existing matches or chats — those
 * stay reachable the whole time (see apps/api/src/snoozeAccount.ts).
 */
export default function SnoozeAccountEditor({ author }: { author: string }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/snooze-account/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setEnabled(body.enabled ?? false))
      .catch(() => {});
  }, [author]);

  const toggle = async (next: boolean) => {
    setEnabled(next);
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/snooze-account/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Snooze account</h2>
      <p style={{ color: "var(--color-muted)" }}>
        Fully hide your profile from everyone in discovery and pause swiping, without deleting your account. Your
        existing matches and chats stay accessible while snoozed.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
        {enabled ? "Your account is snoozed" : "Snooze my account"}
      </label>
    </section>
  );
}
