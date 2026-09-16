"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Ability to set an exact age limit for receiving
 * messages" (#312) — see messageAgeLimit.ts. Only affects the first
 * message from a new 1:1 match, same scope as #135's gender rule.
 */
export default function MessageAgeLimitEditor({ author }: { author: string }) {
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/message-age-limit/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setMinAge(body.limit?.minAge != null ? String(body.limit.minAge) : "");
        setMaxAge(body.limit?.maxAge != null ? String(body.limit.maxAge) : "");
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/message-age-limit/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minAge: minAge === "" ? null : Number(minAge), maxAge: maxAge === "" ? null : Number(maxAge) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to save age limit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save age limit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Age limit for receiving messages</h2>
      <p style={{ color: "var(--color-muted)" }}>Only people within this age range can send you a first message. Leave blank for no limit.</p>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <input type="number" value={minAge} onChange={(e) => setMinAge(e.target.value)} placeholder="Min age" style={{ width: "50%" }} />
        <input type="number" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} placeholder="Max age" style={{ width: "50%" }} />
      </div>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
