"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Match.com's real "Ability to search by blood type (in some cultures)"
 * (#302) — the profile-field half a candidate needs set for that filter
 * (discoveryFilters.ts's requiredBloodTypes) to actually match anyone.
 * Same shape as #301's DietInfoEditor.
 */
export default function BloodTypeInfoEditor({ author }: { author: string }) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [bloodType, setBloodType] = useState<string | null>(null);
  const [hideBloodType, setHideBloodType] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/blood-type-info/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/blood-type-info/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, infoBody]) => {
        setCatalog(catalogBody.bloodTypes ?? []);
        setBloodType(infoBody.bloodTypeInfo?.bloodType ?? null);
        setHideBloodType(infoBody.bloodTypeInfo?.hideBloodType ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async (nextBloodType: string | null, nextHideBloodType: boolean) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/blood-type-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloodType: nextBloodType, hideBloodType: nextHideBloodType }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save blood type");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save blood type");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Blood type</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {catalog.map((option) => (
          <button
            key={option}
            onClick={() => {
              setBloodType(option);
              save(option, hideBloodType);
            }}
            disabled={busy}
            style={{ fontWeight: bloodType === option ? "bold" : "normal" }}
          >
            {option}
          </button>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={hideBloodType}
          onChange={(e) => {
            setHideBloodType(e.target.checked);
            save(bloodType, e.target.checked);
          }}
        />
        Hide blood type on my profile
      </label>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
