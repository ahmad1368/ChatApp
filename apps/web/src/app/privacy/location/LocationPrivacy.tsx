"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Coordinates {
  lat: number;
  lng: number;
}

export default function LocationPrivacy() {
  const searchParams = useSearchParams();
  const [author, setAuthor] = useState(() => searchParams.get("author") ?? "");
  const [approximate, setApproximate] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const shareLocation = () => {
    if (!author.trim()) return;
    if (!navigator.geolocation) {
      setError("Geolocation isn't available in this browser");
      return;
    }
    setError(null);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(author.trim())}/location`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? "Failed to update your location");
          setApproximate(body.approximate);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to update your location");
        } finally {
          setBusy(false);
        }
      },
      () => {
        setError("Location permission was denied");
        setBusy(false);
      }
    );
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Location privacy</h1>

      <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
        <h2 style={{ fontSize: 16 }}>Approximate location only</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          Other people only ever see you as being within about 5&nbsp;km of a point — your exact
          location is never shared or stored on their side.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your display name"
            style={{ padding: 8 }}
          />
          <button
            onClick={shareLocation}
            disabled={!author.trim() || busy}
            style={{ background: "#0070f3", color: "white", border: "none", borderRadius: 6, padding: "10px 16px" }}
          >
            {busy ? "Updating…" : "Share my location"}
          </button>
          {error && <p style={{ color: "#b00020" }}>{error}</p>}
        </div>

        {approximate && (
          <p style={{ marginTop: 12 }}>
            What others see: <strong>~{approximate.lat.toFixed(2)}, {approximate.lng.toFixed(2)}</strong> (within
            5&nbsp;km of your real position)
          </p>
        )}
      </section>
    </main>
  );
}
