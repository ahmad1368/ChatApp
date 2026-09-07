"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_DESTINATION_LENGTH = 80;

export default function TravelModeEditor({ author }: { author: string }) {
  const [active, setActive] = useState(false);
  const [destination, setDestination] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/travel-mode-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setActive(body.travelModeInfo?.active ?? false);
        setDestination(body.travelModeInfo?.destination ?? "");
      })
      .catch(() => {});
  }, [author]);

  const save = async (next: { active: boolean; destination: string }) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/travel-mode-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save travel mode");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save travel mode");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Work / travel mode</h2>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input
          type="checkbox"
          checked={active}
          disabled={busy}
          onChange={(e) => {
            setActive(e.target.checked);
            save({ active: e.target.checked, destination });
          }}
        />
        I&apos;m temporarily somewhere else
      </label>
      {active && (
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value.slice(0, MAX_DESTINATION_LENGTH))}
          onBlur={() => save({ active, destination })}
          placeholder="Where are you traveling?"
          maxLength={MAX_DESTINATION_LENGTH}
          style={{ width: "100%", marginTop: 4 }}
        />
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
