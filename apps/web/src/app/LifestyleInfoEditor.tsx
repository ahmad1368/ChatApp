"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const SMOKING_LABELS: Record<string, string> = { no: "No", sometimes: "Sometimes", yes: "Yes" };
const DRINKING_LABELS: Record<string, string> = {
  no: "No",
  sometimes: "Sometimes",
  yes: "Yes",
  onSpecialOccasions: "On special occasions",
};

export default function LifestyleInfoEditor({ author }: { author: string }) {
  const [smoking, setSmoking] = useState("");
  const [drinking, setDrinking] = useState("");
  const [hideSmoking, setHideSmoking] = useState(false);
  const [hideDrinking, setHideDrinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/lifestyle-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setSmoking(body.lifestyleInfo?.smoking ?? "");
        setDrinking(body.lifestyleInfo?.drinking ?? "");
        setHideSmoking(body.lifestyleInfo?.hideSmoking ?? false);
        setHideDrinking(body.lifestyleInfo?.hideDrinking ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/lifestyle-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smoking: smoking || null,
          drinking: drinking || null,
          hideSmoking,
          hideDrinking,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save lifestyle info");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lifestyle info");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Smoking &amp; drinking</h2>
      <label style={{ display: "block", marginTop: 4 }}>
        Smoking
        <select value={smoking} onChange={(e) => setSmoking(e.target.value)} style={{ width: "100%", marginTop: 2 }}>
          <option value="">Prefer not to say</option>
          {Object.entries(SMOKING_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideSmoking} onChange={(e) => setHideSmoking(e.target.checked)} />
        Hide smoking status on my profile
      </label>

      <label style={{ display: "block", marginTop: 8 }}>
        Drinking
        <select value={drinking} onChange={(e) => setDrinking(e.target.value)} style={{ width: "100%", marginTop: 2 }}>
          <option value="">Prefer not to say</option>
          {Object.entries(DRINKING_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideDrinking} onChange={(e) => setHideDrinking(e.target.checked)} />
        Hide drinking status on my profile
      </label>

      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
