"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const MODE_LABELS: Record<string, string> = { cafes: "☕ Cafes", sports: "🏃 Sports", travel: "✈️ Travel" };

/**
 * Tinder's real Explore Mode (#99): pick a themed deck (cafes/sports/
 * travel) instead of the normal, unfiltered discovery deck — see
 * exploreMode.ts for how a theme narrows candidates by shared interests.
 */
export default function ExploreModeSelector({
  author,
  onChange,
}: {
  author: string;
  onChange: () => void;
}) {
  const [modes, setModes] = useState<string[]>([]);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/explore-mode/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/explore-mode/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, modeBody]) => {
        setModes(catalogBody.modes ?? []);
        setActiveMode(modeBody.mode ?? null);
      })
      .catch(() => {});
  }, [author]);

  const selectMode = async (mode: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/explore-mode/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        setActiveMode(mode);
        onChange();
      }
    } catch {
      // Non-critical to the swipe flow — leave the previous mode selected.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
      <button
        onClick={() => selectMode(null)}
        disabled={busy}
        style={{ fontWeight: activeMode === null ? "bold" : "normal" }}
      >
        All
      </button>
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => selectMode(mode)}
          disabled={busy}
          style={{ fontWeight: activeMode === mode ? "bold" : "normal" }}
        >
          {MODE_LABELS[mode] ?? mode}
        </button>
      ))}
    </div>
  );
}
