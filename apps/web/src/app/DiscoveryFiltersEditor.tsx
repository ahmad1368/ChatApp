"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * OkCupid's advanced discovery filters (#96): height range, education
 * requirement, and required languages. Narrows /api/swipe-candidates for
 * this author — see discoveryFilters.ts for the matching logic.
 */
export default function DiscoveryFiltersEditor({ author }: { author: string }) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [minHeightCm, setMinHeightCm] = useState("");
  const [maxHeightCm, setMaxHeightCm] = useState("");
  const [requireEducation, setRequireEducation] = useState(false);
  const [requiredLanguages, setRequiredLanguages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/languages-info/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/discovery-filters/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, filtersBody]) => {
        setCatalog(catalogBody.languages ?? []);
        const filters = filtersBody.filters;
        setMinHeightCm(filters?.minHeightCm != null ? String(filters.minHeightCm) : "");
        setMaxHeightCm(filters?.maxHeightCm != null ? String(filters.maxHeightCm) : "");
        setRequireEducation(filters?.requireEducation ?? false);
        setRequiredLanguages(filters?.requiredLanguages ?? []);
      })
      .catch(() => {});
  }, [author]);

  const toggleLanguage = (language: string) => {
    setRequiredLanguages((prev) =>
      prev.includes(language) ? prev.filter((l) => l !== language) : [...prev, language]
    );
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/discovery-filters/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minHeightCm: minHeightCm === "" ? null : Number(minHeightCm),
          maxHeightCm: maxHeightCm === "" ? null : Number(maxHeightCm),
          requireEducation,
          requiredLanguages,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save discovery filters");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save discovery filters");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Discovery filters</h2>
      <p style={{ color: "var(--color-muted)" }}>Only show me people who match these.</p>

      <label style={{ display: "block", marginTop: 8 }}>
        Min height (cm)
        <input
          type="number"
          value={minHeightCm}
          onChange={(e) => setMinHeightCm(e.target.value)}
          style={{ width: "100%", marginTop: 4 }}
        />
      </label>
      <label style={{ display: "block", marginTop: 8 }}>
        Max height (cm)
        <input
          type="number"
          value={maxHeightCm}
          onChange={(e) => setMaxHeightCm(e.target.value)}
          style={{ width: "100%", marginTop: 4 }}
        />
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={requireEducation}
          onChange={(e) => setRequireEducation(e.target.checked)}
        />
        Only show people with education listed
      </label>

      <p style={{ marginTop: 8, marginBottom: 4 }}>Must speak at least one of:</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {catalog.map((language) => {
          const isSelected = requiredLanguages.includes(language);
          return (
            <button
              key={language}
              onClick={() => toggleLanguage(language)}
              style={{ textTransform: "capitalize", fontWeight: isSelected ? "bold" : "normal" }}
            >
              {language}
            </button>
          );
        })}
      </div>

      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
