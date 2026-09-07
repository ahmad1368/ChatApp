"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const THEME_COLORS: Record<string, string> = {
  classic: "#4a5568",
  sunset: "#dd6b20",
  ocean: "#2b6cb0",
  blossom: "#d53f8c",
  midnight: "#2d3748",
  citrus: "#d69e2e",
};

export default function ProfileColorThemeEditor({ author }: { author: string }) {
  const [themes, setThemes] = useState<string[]>([]);
  const [theme, setTheme] = useState("classic");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/profile-color-theme/themes`).then((res) => res.json()),
      fetch(`${API_URL}/api/profile-color-theme/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([themesBody, themeBody]) => {
        setThemes(themesBody.themes ?? []);
        setTheme(themeBody.theme ?? "classic");
      })
      .catch(() => {});
  }, [author]);

  const choose = async (next: string) => {
    setTheme(next);
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/profile-color-theme/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Profile color theme</h2>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {themes.map((t) => (
          <button
            key={t}
            onClick={() => choose(t)}
            disabled={busy}
            title={t}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: THEME_COLORS[t] ?? "#888",
              border: theme === t ? "3px solid var(--color-fg, #000)" : "1px solid var(--color-border)",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </section>
  );
}
