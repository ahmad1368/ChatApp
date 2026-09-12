"use client";

import { useEffect, useState } from "react";
import { cmToFeetInches, feetInchesToCm, MeasurementSystem } from "./measurementUnits";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * #163's "Set measurement units" applied to the one measurement this app
 * actually collects from a user: height stays stored in cm (see
 * heightInfo.ts) — an imperial viewer just gets a feet/inches input that
 * converts through cm on save, the same "canonical unit server-side,
 * converted client-side" split as measurementUnits.ts's doc comment.
 */
export default function HeightInfoEditor({ author }: { author: string }) {
  const [heightCm, setHeightCm] = useState("");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [hideHeight, setHideHeight] = useState(false);
  const [system, setSystem] = useState<MeasurementSystem>("metric");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/height-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        const cm = body.heightInfo?.heightCm;
        setHeightCm(cm != null ? String(cm) : "");
        if (cm != null) {
          const converted = cmToFeetInches(cm);
          setFeet(String(converted.feet));
          setInches(String(converted.inches));
        }
        setHideHeight(body.heightInfo?.hideHeight ?? false);
      })
      .catch(() => {});
    fetch(`${API_URL}/api/measurement-units/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => body?.system && setSystem(body.system))
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const resolvedCm =
        system === "metric"
          ? heightCm === ""
            ? null
            : Number(heightCm)
          : feet === "" && inches === ""
            ? null
            : feetInchesToCm(Number(feet || 0), Number(inches || 0));
      const res = await fetch(`${API_URL}/api/height-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heightCm: resolvedCm, hideHeight }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save height");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save height");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Height</h2>
      {system === "metric" ? (
        <input
          type="number"
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          placeholder="Height in cm"
          style={{ width: "100%", marginTop: 4 }}
        />
      ) : (
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            type="number"
            value={feet}
            onChange={(e) => setFeet(e.target.value)}
            placeholder="Feet"
            style={{ width: "50%" }}
          />
          <input
            type="number"
            value={inches}
            onChange={(e) => setInches(e.target.value)}
            placeholder="Inches"
            style={{ width: "50%" }}
          />
        </div>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideHeight} onChange={(e) => setHideHeight(e.target.checked)} />
        Hide height on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
