"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";
import { MeasurementSystem } from "../../measurementUnits";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Set measurement units (cm/inch, km/miles)" (#163).
 * Height (from #67's heightInfo.ts) is the only measurement this app
 * actually shows a user — see measurementUnits.ts for why distance
 * (km/miles) has no display surface here yet. Changing this only affects
 * how numbers are shown/entered; the stored value stays cm either way.
 */
export default function MeasurementUnitsSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [system, setSystem] = useState<MeasurementSystem>("metric");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/measurement-units/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => body?.system && setSystem(body.system))
      .catch(() => {});
  }, [author]);

  const choose = (next: MeasurementSystem) => {
    setSystem(next);
    setStatus(null);
    fetch(`${API_URL}/api/measurement-units/${encodeURIComponent(author)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: next }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("Saved.");
      })
      .catch(() => setStatus("Failed to save — please try again."));
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Measurement units</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>Applies to height on your profile and others'.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="radio" name="system" checked={system === "metric"} onChange={() => choose("metric")} />
          Metric (cm)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="radio" name="system" checked={system === "imperial"} onChange={() => choose("imperial")} />
          Imperial (ft, in)
        </label>
      </div>

      {status && <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 12 }}>{status}</p>}
    </main>
  );
}
