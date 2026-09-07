"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_SELECTED_INTERESTS = 10;

export default function InterestsInfoEditor({ author }: { author: string }) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hideInterests, setHideInterests] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/interests-info/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/interests-info/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, infoBody]) => {
        setCatalog(catalogBody.interests ?? []);
        setSelected(infoBody.interestsInfo?.interests ?? []);
        setHideInterests(infoBody.interestsInfo?.hideInterests ?? false);
      })
      .catch(() => {});
  }, [author]);

  const toggle = (interest: string) => {
    setSelected((prev) => {
      if (prev.includes(interest)) return prev.filter((i) => i !== interest);
      if (prev.length >= MAX_SELECTED_INTERESTS) return prev;
      return [...prev, interest];
    });
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/interests-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selected, hideInterests }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save interests");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save interests");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Interests</h2>
      <p style={{ color: "var(--color-muted)" }}>Pick up to {MAX_SELECTED_INTERESTS}.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {catalog.map((interest) => {
          const isSelected = selected.includes(interest);
          return (
            <button
              key={interest}
              onClick={() => toggle(interest)}
              disabled={!isSelected && selected.length >= MAX_SELECTED_INTERESTS}
              style={{ textTransform: "capitalize", fontWeight: isSelected ? "bold" : "normal" }}
            >
              {interest}
            </button>
          );
        })}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input type="checkbox" checked={hideInterests} onChange={(e) => setHideInterests(e.target.checked)} />
        Hide interests on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
