"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_SELECTED_LANGUAGES = 5;

export default function LanguagesInfoEditor({ author }: { author: string }) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hideLanguages, setHideLanguages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/languages-info/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/languages-info/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, infoBody]) => {
        setCatalog(catalogBody.languages ?? []);
        setSelected(infoBody.languagesInfo?.languages ?? []);
        setHideLanguages(infoBody.languagesInfo?.hideLanguages ?? false);
      })
      .catch(() => {});
  }, [author]);

  const toggle = (language: string) => {
    setSelected((prev) => {
      if (prev.includes(language)) return prev.filter((l) => l !== language);
      if (prev.length >= MAX_SELECTED_LANGUAGES) return prev;
      return [...prev, language];
    });
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/languages-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languages: selected, hideLanguages }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save languages");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save languages");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Languages I speak</h2>
      <p style={{ color: "var(--color-muted)" }}>Pick up to {MAX_SELECTED_LANGUAGES}.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {catalog.map((language) => {
          const isSelected = selected.includes(language);
          return (
            <button
              key={language}
              onClick={() => toggle(language)}
              disabled={!isSelected && selected.length >= MAX_SELECTED_LANGUAGES}
              style={{
                textTransform: "capitalize",
                fontWeight: isSelected ? "bold" : "normal",
              }}
            >
              {language}
            </button>
          );
        })}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input type="checkbox" checked={hideLanguages} onChange={(e) => setHideLanguages(e.target.checked)} />
        Hide languages on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
