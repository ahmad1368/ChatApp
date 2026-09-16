"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * A real, self-reported age — #312's prerequisite (see ageInfo.ts for why
 * this is honestly self-reported, not ID-verified). #80's existing
 * hideAge toggle (ProfileVisibilityEditor) controls whether it's shown on
 * the profile; this editor only sets the underlying value.
 */
export default function AgeInfoEditor({ author }: { author: string }) {
  const [age, setAge] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/age-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setAge(body.age != null ? String(body.age) : ""))
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/age-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age: age === "" ? null : Number(age) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to save age");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save age");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Age</h2>
      <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Your age" style={{ width: "100%", marginTop: 4 }} />
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
