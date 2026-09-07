"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_SELECTED_PETS = 3;

const PET_LABELS: Record<string, string> = {
  dog: "Dog",
  cat: "Cat",
  bird: "Bird",
  fish: "Fish",
  reptile: "Reptile",
  amphibian: "Amphibian",
  otherPet: "Other pet",
  noPets: "No pets",
  petFree: "Pet-free",
  wantAPet: "Want a pet",
  allergicToPets: "Allergic to pets",
};

export default function PetsInfoEditor({ author }: { author: string }) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hidePets, setHidePets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/pets-info/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/pets-info/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, infoBody]) => {
        setCatalog(catalogBody.pets ?? []);
        setSelected(infoBody.petsInfo?.pets ?? []);
        setHidePets(infoBody.petsInfo?.hidePets ?? false);
      })
      .catch(() => {});
  }, [author]);

  const toggle = (pet: string) => {
    setSelected((prev) => {
      if (prev.includes(pet)) return prev.filter((p) => p !== pet);
      if (prev.length >= MAX_SELECTED_PETS) return prev;
      return [...prev, pet];
    });
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/pets-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pets: selected, hidePets }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save pet status");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pet status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Pets</h2>
      <p style={{ color: "var(--color-muted)" }}>Pick up to {MAX_SELECTED_PETS}.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {catalog.map((pet) => {
          const isSelected = selected.includes(pet);
          return (
            <button
              key={pet}
              onClick={() => toggle(pet)}
              disabled={!isSelected && selected.length >= MAX_SELECTED_PETS}
              style={{ fontWeight: isSelected ? "bold" : "normal" }}
            >
              {PET_LABELS[pet] ?? pet}
            </button>
          );
        })}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input type="checkbox" checked={hidePets} onChange={(e) => setHidePets(e.target.checked)} />
        Hide pet status on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
