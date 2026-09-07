"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const FAMILY_PLANS_LABELS: Record<string, string> = {
  dontWantChildren: "Don't want children",
  wantChildren: "Want children",
  openToChildren: "Open to children",
  notSureYet: "Not sure yet",
};

export default function FamilyPlansInfoEditor({ author }: { author: string }) {
  const [familyPlans, setFamilyPlans] = useState("");
  const [hideFamilyPlans, setHideFamilyPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/family-plans-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setFamilyPlans(body.familyPlansInfo?.familyPlans ?? "");
        setHideFamilyPlans(body.familyPlansInfo?.hideFamilyPlans ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/family-plans-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyPlans: familyPlans || null, hideFamilyPlans }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save family plans");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save family plans");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Family plans</h2>
      <select value={familyPlans} onChange={(e) => setFamilyPlans(e.target.value)} style={{ width: "100%", marginTop: 4 }}>
        <option value="">Prefer not to say</option>
        {Object.entries(FAMILY_PLANS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideFamilyPlans} onChange={(e) => setHideFamilyPlans(e.target.checked)} />
        Hide family plans on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
