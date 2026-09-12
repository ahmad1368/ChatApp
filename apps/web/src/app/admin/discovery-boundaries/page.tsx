"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Bumble's real "Set default geographic boundaries and discovery radii"
 * (#183). A single platform-wide setting (not per-author) — see
 * discoveryBoundaries.ts for how onboarding.ts's searchRadius step
 * actually enforces it.
 */
export default function AdminDiscoveryBoundariesPage() {
  const [adminKey, setAdminKey] = useState("");
  const [minRadiusKm, setMinRadiusKm] = useState("");
  const [maxRadiusKm, setMaxRadiusKm] = useState("");
  const [defaultRadiusKm, setDefaultRadiusKm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setError(null);
    setSaved(false);
    const res = await fetch(`${API_URL}/api/discovery-boundaries`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError("Failed to load boundaries");
      return;
    }
    setMinRadiusKm(String(body.minRadiusKm));
    setMaxRadiusKm(String(body.maxRadiusKm));
    setDefaultRadiusKm(String(body.defaultRadiusKm));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const res = await fetch(`${API_URL}/api/admin/discovery-boundaries`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({
        minRadiusKm: Number(minRadiusKm),
        maxRadiusKm: Number(maxRadiusKm),
        defaultRadiusKm: Number(defaultRadiusKm),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to save boundaries");
      return;
    }
    setSaved(true);
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Discovery radius boundaries</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        style={{ display: "flex", gap: 8, marginTop: 16 }}
      >
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Admin key"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit">Load current values</button>
      </form>

      {error && <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{error}</p>}
      {saved && <p style={{ marginTop: 12 }}>Saved.</p>}

      <form onSubmit={save} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 20 }}>
        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Minimum radius (km)</label>
        <input
          type="number"
          min={1}
          value={minRadiusKm}
          onChange={(e) => setMinRadiusKm(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
        />
        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Maximum radius (km)</label>
        <input
          type="number"
          min={1}
          value={maxRadiusKm}
          onChange={(e) => setMaxRadiusKm(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
        />
        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Default radius (km) shown to new users</label>
        <input
          type="number"
          min={1}
          value={defaultRadiusKm}
          onChange={(e) => setDefaultRadiusKm(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
        />
        <button type="submit" disabled={!adminKey || !minRadiusKm || !maxRadiusKm || !defaultRadiusKm}>
          Save
        </button>
      </form>
    </main>
  );
}
