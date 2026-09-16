"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const COUNTRY_LABELS: Record<string, string> = {
  canada: "Canada",
  unitedStates: "United States",
  unitedKingdom: "United Kingdom",
  australia: "Australia",
  newZealand: "New Zealand",
  germany: "Germany",
  netherlands: "Netherlands",
  ireland: "Ireland",
  sweden: "Sweden",
  switzerland: "Switzerland",
  singapore: "Singapore",
  japan: "Japan",
  southKorea: "South Korea",
  unitedArabEmirates: "United Arab Emirates",
  spain: "Spain",
  portugal: "Portugal",
  italy: "Italy",
  france: "France",
  mexico: "Mexico",
  brazil: "Brazil",
};

/**
 * Match.com's real "Ability to select a target immigration country to
 * find a travel companion" (#325) — see targetImmigrationCountry.ts.
 */
export default function TargetImmigrationCountryEditor({ author }: { author: string }) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [targetCountry, setTargetCountry] = useState("");
  const [hideTargetCountry, setHideTargetCountry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/target-immigration-country/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/target-immigration-country/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, infoBody]) => {
        setCatalog(catalogBody.countries ?? []);
        setTargetCountry(infoBody.info?.targetCountry ?? "");
        setHideTargetCountry(infoBody.info?.hideTargetCountry ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/target-immigration-country/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCountry: targetCountry || null, hideTargetCountry }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to save target country");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save target country");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Target immigration country</h2>
      <p style={{ color: "var(--color-muted)" }}>
        Planning to move somewhere? Set your target country and find others planning the same move.
      </p>
      <select value={targetCountry} onChange={(e) => setTargetCountry(e.target.value)} style={{ width: "100%", marginTop: 4 }}>
        <option value="">Not set</option>
        {catalog.map((country) => (
          <option key={country} value={country}>
            {COUNTRY_LABELS[country] ?? country}
          </option>
        ))}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input type="checkbox" checked={hideTargetCountry} onChange={(e) => setHideTargetCountry(e.target.checked)} />
        Hide target country on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
