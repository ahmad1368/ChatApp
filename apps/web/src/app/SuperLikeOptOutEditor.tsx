"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Ability to disable receiving Super Likes" (#308) — see
 * superLikeOptOut.ts. An incoming Super Like is silently delivered as a
 * regular Like instead while this is enabled.
 */
export default function SuperLikeOptOutEditor({ author }: { author: string }) {
  const [disabled, setDisabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/super-like-opt-out/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setDisabled(body.disabled ?? false))
      .catch(() => {});
  }, [author]);

  const toggle = async (next: boolean) => {
    setDisabled(next);
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/super-like-opt-out/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: next }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Super Likes</h2>
      <p style={{ color: "var(--color-muted)" }}>
        Stop receiving Super Likes — anyone who tries to Super Like you will send a regular Like instead.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={disabled} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
        {disabled ? "Super Likes disabled" : "Disable receiving Super Likes"}
      </label>
    </section>
  );
}
