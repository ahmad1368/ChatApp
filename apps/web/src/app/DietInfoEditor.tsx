"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const DIET_LABELS: Record<string, string> = {
  omnivore: "Omnivore",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  other: "Other",
};

/**
 * OkCupid's real "Filter by diet type (vegetarian, vegan, omnivore)"
 * (#301) — the profile-field half a candidate needs set for that filter
 * (discoveryFilters.ts's requiredDiets) to actually match anyone.
 */
export default function DietInfoEditor({ author }: { author: string }) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [diet, setDiet] = useState<string | null>(null);
  const [hideDiet, setHideDiet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/diet-info/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/diet-info/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, infoBody]) => {
        setCatalog(catalogBody.diets ?? []);
        setDiet(infoBody.dietInfo?.diet ?? null);
        setHideDiet(infoBody.dietInfo?.hideDiet ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async (nextDiet: string | null, nextHideDiet: boolean) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/diet-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diet: nextDiet, hideDiet: nextHideDiet }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save diet");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save diet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Diet</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {catalog.map((option) => (
          <button
            key={option}
            onClick={() => {
              setDiet(option);
              save(option, hideDiet);
            }}
            disabled={busy}
            style={{ fontWeight: diet === option ? "bold" : "normal" }}
          >
            {DIET_LABELS[option] ?? option}
          </button>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={hideDiet}
          onChange={(e) => {
            setHideDiet(e.target.checked);
            save(diet, e.target.checked);
          }}
        />
        Hide diet on my profile
      </label>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
