"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Bumble's real Incognito Mode (#111): while on, this author is hidden
 * from everyone's discovery deck except someone they've already liked or
 * superliked themselves — see apps/api/src/vanishMode.ts for why that
 * specific exception rather than a blanket "invisible to everyone" toggle.
 */
export default function VanishModeEditor({ author }: { author: string }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/vanish-mode/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setEnabled(body.enabled ?? false))
      .catch(() => {});
  }, [author]);

  const toggle = async (next: boolean) => {
    setEnabled(next);
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/vanish-mode/${encodeURIComponent(author)}`, {
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
      <h2 style={{ fontSize: 14 }}>Vanish mode</h2>
      <p style={{ color: "var(--color-muted)" }}>
        Hide your profile from everyone in discovery, except people you&apos;ve already liked.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
        {enabled ? "You're vanished" : "Enable vanish mode"}
      </label>
    </section>
  );
}
