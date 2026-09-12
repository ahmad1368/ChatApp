"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ExploreTheme {
  id: string;
  name: string;
}

/**
 * Tinder's real Explore Mode (#99): pick a themed deck instead of the
 * normal, unfiltered discovery deck — see exploreMode.ts for how a theme
 * narrows candidates by shared interests. #182 made the theme catalog
 * itself admin-managed (exploreThemes.ts), so the names and set of
 * themes shown here come entirely from the server, not a hardcoded list.
 */
export default function ExploreModeSelector({
  author,
  onChange,
}: {
  author: string;
  onChange: () => void;
}) {
  const [themes, setThemes] = useState<ExploreTheme[]>([]);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/explore-mode/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/explore-mode/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, modeBody]) => {
        setThemes(catalogBody.themes ?? []);
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
      {themes.map((theme) => (
        <button
          key={theme.id}
          onClick={() => selectMode(theme.id)}
          disabled={busy}
          style={{ fontWeight: activeMode === theme.id ? "bold" : "normal" }}
        >
          {theme.name}
        </button>
      ))}
    </div>
  );
}
