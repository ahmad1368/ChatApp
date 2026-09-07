"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real Passport (#102): manually set your discovery location to
 * a different city, overriding your real GPS location until you turn it
 * off. No geocoding service exists in this app (same scoping call as the
 * OAuth provider stubs elsewhere), so the city's coordinates are entered
 * directly rather than looked up from a typed city search.
 */
export default function PassportModeEditor({ author }: { author: string }) {
  const [active, setActive] = useState(false);
  const [activeCityName, setActiveCityName] = useState<string | null>(null);
  const [cityName, setCityName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(`${API_URL}/api/users/${encodeURIComponent(author)}/passport-location`)
      .then((res) => res.json())
      .then((body) => {
        setActive(body.active ?? false);
        setActiveCityName(body.cityName ?? null);
      })
      .catch(() => {});
  };

  useEffect(load, [author]);

  const activate = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(author)}/passport-location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityName, coordinates: { lat: Number(lat), lng: Number(lng) } }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to activate Passport mode");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate Passport mode");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setError(null);
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/users/${encodeURIComponent(author)}/passport-location`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate Passport mode");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Passport</h2>
      <p style={{ color: "var(--color-muted)" }}>See and be seen by people in another city.</p>

      {active ? (
        <>
          <p>
            Currently browsing as if you&apos;re in <strong>{activeCityName}</strong>.
          </p>
          <button onClick={deactivate} disabled={busy}>
            Turn off Passport
          </button>
        </>
      ) : (
        <>
          <input
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            placeholder="City name"
            style={{ width: "100%", marginTop: 4 }}
          />
          <input
            type="number"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="Latitude"
            style={{ width: "100%", marginTop: 4 }}
          />
          <input
            type="number"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="Longitude"
            style={{ width: "100%", marginTop: 4 }}
          />
          <button onClick={activate} disabled={busy || !cityName.trim() || lat === "" || lng === ""} style={{ marginTop: 8 }}>
            Activate Passport
          </button>
        </>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
