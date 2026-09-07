"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Emoji stand-ins for actual preset illustrations/3D renders — this app has
// no art pipeline to generate the real assets, same scoping note as
// stylizedAvatar.ts.
const STYLE_PREVIEWS: Record<string, string> = {
  cartoonA: "🙂",
  cartoonB: "😎",
  cartoonC: "🥳",
  threeDA: "🧑‍🎨",
  threeDB: "🦸",
  threeDC: "🧑‍🚀",
};

export default function StylizedAvatarEditor({ author }: { author: string }) {
  const [styles, setStyles] = useState<string[]>([]);
  const [style, setStyle] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/stylized-avatar/styles`).then((res) => res.json()),
      fetch(`${API_URL}/api/stylized-avatar/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([stylesBody, infoBody]) => {
        setStyles(stylesBody.styles ?? []);
        setStyle(infoBody.stylizedAvatarInfo?.style ?? null);
        setActive(infoBody.stylizedAvatarInfo?.active ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async (next: { style: string | null; active: boolean }) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/stylized-avatar/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save avatar style");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save avatar style");
    } finally {
      setBusy(false);
    }
  };

  const choose = (next: string) => {
    setStyle(next);
    save({ style: next, active });
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>3D / cartoon avatar</h2>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {styles.map((s) => (
          <button
            key={s}
            onClick={() => choose(s)}
            disabled={busy}
            style={{
              fontSize: 22,
              border: style === s ? "2px solid var(--color-fg, #000)" : "1px solid var(--color-border)",
              borderRadius: 8,
              padding: 4,
            }}
          >
            {STYLE_PREVIEWS[s] ?? "?"}
          </button>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={active}
          disabled={busy || !style}
          onChange={(e) => {
            setActive(e.target.checked);
            save({ style, active: e.target.checked });
          }}
        />
        Show this instead of my photo
      </label>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
