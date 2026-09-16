"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const DRINKING_LABELS: Record<string, string> = {
  no: "No",
  sometimes: "Sometimes",
  yes: "Yes",
  onSpecialOccasions: "On special occasions",
};

/**
 * OkCupid/Match.com's advanced discovery filters (#96, extended by #97,
 * #98, #257, #301, and #302): height range, education requirement,
 * required languages, non-smoking, allowed drinking, verified-only,
 * favorite pets, required diet type, and required blood type. Narrows
 * /api/swipe-candidates for this author — see discoveryFilters.ts for
 * the matching logic and for the documented gap between this app's
 * guest identities and real, selfie-verified accounts that "verified
 * only" relies on.
 */
export default function DiscoveryFiltersEditor({ author }: { author: string }) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [petCatalog, setPetCatalog] = useState<string[]>([]);
  const [dietCatalog, setDietCatalog] = useState<string[]>([]);
  const [bloodTypeCatalog, setBloodTypeCatalog] = useState<string[]>([]);
  const [minHeightCm, setMinHeightCm] = useState("");
  const [maxHeightCm, setMaxHeightCm] = useState("");
  const [requireEducation, setRequireEducation] = useState(false);
  const [requiredLanguages, setRequiredLanguages] = useState<string[]>([]);
  const [requireNonSmoking, setRequireNonSmoking] = useState(false);
  const [allowedDrinking, setAllowedDrinking] = useState<string[]>([]);
  const [requireVerifiedOnly, setRequireVerifiedOnly] = useState(false);
  const [requiredPets, setRequiredPets] = useState<string[]>([]);
  const [requiredDiets, setRequiredDiets] = useState<string[]>([]);
  const [requiredBloodTypes, setRequiredBloodTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/languages-info/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/pets-info/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/diet-info/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/blood-type-info/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/discovery-filters/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, petCatalogBody, dietCatalogBody, bloodTypeCatalogBody, filtersBody]) => {
        setCatalog(catalogBody.languages ?? []);
        setPetCatalog(petCatalogBody.pets ?? []);
        setDietCatalog(dietCatalogBody.diets ?? []);
        setBloodTypeCatalog(bloodTypeCatalogBody.bloodTypes ?? []);
        const filters = filtersBody.filters;
        setMinHeightCm(filters?.minHeightCm != null ? String(filters.minHeightCm) : "");
        setMaxHeightCm(filters?.maxHeightCm != null ? String(filters.maxHeightCm) : "");
        setRequireEducation(filters?.requireEducation ?? false);
        setRequiredLanguages(filters?.requiredLanguages ?? []);
        setRequireNonSmoking(filters?.requireNonSmoking ?? false);
        setAllowedDrinking(filters?.allowedDrinking ?? []);
        setRequireVerifiedOnly(filters?.requireVerifiedOnly ?? false);
        setRequiredPets(filters?.requiredPets ?? []);
        setRequiredDiets(filters?.requiredDiets ?? []);
        setRequiredBloodTypes(filters?.requiredBloodTypes ?? []);
      })
      .catch(() => {});
  }, [author]);

  const toggleLanguage = (language: string) => {
    setRequiredLanguages((prev) =>
      prev.includes(language) ? prev.filter((l) => l !== language) : [...prev, language]
    );
  };

  const toggleDrinking = (option: string) => {
    setAllowedDrinking((prev) => (prev.includes(option) ? prev.filter((d) => d !== option) : [...prev, option]));
  };

  const togglePet = (pet: string) => {
    setRequiredPets((prev) => (prev.includes(pet) ? prev.filter((p) => p !== pet) : [...prev, pet]));
  };

  const toggleDiet = (diet: string) => {
    setRequiredDiets((prev) => (prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]));
  };

  const toggleBloodType = (bloodType: string) => {
    setRequiredBloodTypes((prev) => (prev.includes(bloodType) ? prev.filter((b) => b !== bloodType) : [...prev, bloodType]));
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
          requireNonSmoking,
          allowedDrinking,
          requireVerifiedOnly,
          requiredPets,
          requiredDiets,
          requiredBloodTypes,
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

      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={requireNonSmoking}
          onChange={(e) => setRequireNonSmoking(e.target.checked)}
        />
        Only show non-smokers
      </label>

      <p style={{ marginTop: 8, marginBottom: 4 }}>Acceptable drinking habits:</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {Object.entries(DRINKING_LABELS).map(([value, label]) => {
          const isSelected = allowedDrinking.includes(value);
          return (
            <button
              key={value}
              onClick={() => toggleDrinking(value)}
              style={{ fontWeight: isSelected ? "bold" : "normal" }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={requireVerifiedOnly}
          onChange={(e) => setRequireVerifiedOnly(e.target.checked)}
        />
        Only show verified profiles
      </label>

      <p style={{ marginTop: 8, marginBottom: 4 }}>Must have at least one of these pets:</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {petCatalog.map((pet) => {
          const isSelected = requiredPets.includes(pet);
          return (
            <button
              key={pet}
              onClick={() => togglePet(pet)}
              style={{ textTransform: "capitalize", fontWeight: isSelected ? "bold" : "normal" }}
            >
              {pet}
            </button>
          );
        })}
      </div>

      <p style={{ marginTop: 8, marginBottom: 4 }}>Must have one of these diets:</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {dietCatalog.map((diet) => {
          const isSelected = requiredDiets.includes(diet);
          return (
            <button
              key={diet}
              onClick={() => toggleDiet(diet)}
              style={{ textTransform: "capitalize", fontWeight: isSelected ? "bold" : "normal" }}
            >
              {diet}
            </button>
          );
        })}
      </div>

      <p style={{ marginTop: 8, marginBottom: 4 }}>Must have one of these blood types:</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {bloodTypeCatalog.map((bloodType) => {
          const isSelected = requiredBloodTypes.includes(bloodType);
          return (
            <button
              key={bloodType}
              onClick={() => toggleBloodType(bloodType)}
              style={{ fontWeight: isSelected ? "bold" : "normal" }}
            >
              {bloodType}
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
