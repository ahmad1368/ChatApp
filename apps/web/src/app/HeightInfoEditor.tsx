"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function HeightInfoEditor({ author }: { author: string }) {
  const [heightCm, setHeightCm] = useState("");
  const [hideHeight, setHideHeight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/height-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setHeightCm(body.heightInfo?.heightCm != null ? String(body.heightInfo.heightCm) : "");
        setHideHeight(body.heightInfo?.hideHeight ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/height-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heightCm: heightCm === "" ? null : Number(heightCm), hideHeight }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save height");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save height");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Height</h2>
      <input
        type="number"
        value={heightCm}
        onChange={(e) => setHeightCm(e.target.value)}
        placeholder="Height in cm"
        style={{ width: "100%", marginTop: 4 }}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideHeight} onChange={(e) => setHideHeight(e.target.checked)} />
        Hide height on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
