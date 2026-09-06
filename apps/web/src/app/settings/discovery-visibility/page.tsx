"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuth, loadStoredAuth } from "../../authClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Preferences {
  city: string;
  workplace: string;
  hideFromSameCity: boolean;
  hideFromSameWorkplace: boolean;
}

const DEFAULT_PREFERENCES: Preferences = { city: "", workplace: "", hideFromSameCity: false, hideFromSameWorkplace: false };

export default function DiscoveryVisibilityPage() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [status, setStatus] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loadStoredAuth()) return;
    setSignedIn(true);
    fetchWithAuth(`${API_URL}/api/discovery-visibility`)
      .then((res) => (res.ok ? res.json() : undefined))
      .then((body) => body && setPreferences(body))
      .catch(() => undefined);
  }, []);

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/discovery-visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setPreferences(body);
      setStatus("Saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/settings/security">&larr; Back to Security</Link>
      </p>
      <h1>Discovery visibility</h1>
      <p style={{ color: "#666", fontSize: 13 }}>
        Keep your profile out of the discovery feed for people from the same city or workplace — useful for avoiding
        coworkers or neighbors.
      </p>

      {!signedIn && <p style={{ color: "#b00020" }}>Sign in first to manage this setting.</p>}

      {signedIn && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          <label style={{ fontSize: 13 }}>
            City
            <input
              value={preferences.city}
              onChange={(e) => setPreferences({ ...preferences, city: e.target.value })}
              placeholder="e.g. Springfield"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={preferences.hideFromSameCity}
              onChange={(e) => setPreferences({ ...preferences, hideFromSameCity: e.target.checked })}
            />
            Hide my profile from people in my city
          </label>

          <label style={{ fontSize: 13 }}>
            Workplace
            <input
              value={preferences.workplace}
              onChange={(e) => setPreferences({ ...preferences, workplace: e.target.value })}
              placeholder="e.g. Acme Corp"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={preferences.hideFromSameWorkplace}
              onChange={(e) => setPreferences({ ...preferences, hideFromSameWorkplace: e.target.checked })}
            />
            Hide my profile from people at my workplace
          </label>

          <button onClick={save} disabled={busy} style={{ padding: 10 }}>
            {busy ? "Saving…" : "Save"}
          </button>
          {status && <p style={{ fontSize: 13, color: "#6b7280" }}>{status}</p>}
        </div>
      )}
    </main>
  );
}
