"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface VerificationRecord {
  verified: boolean;
  distanceKm: number | null;
  verifiedAt: string | null;
  reason?: string;
}

/**
 * Raya's real "Real GPS location verification system that doesn't work
 * with VPN (optional)" (#299) — uses the browser's real Geolocation API
 * (the same honest "real native capability" scoping as #244's
 * VoiceSwipeControl), then cross-references it server-side against a
 * real IP-based lookup (see gpsVerification.ts). No browser API can
 * actually prove a device isn't using a VPN, so this is disclosed as a
 * real heuristic, not a guarantee.
 */
export default function GpsVerificationSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [record, setRecord] = useState<VerificationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "geolocation" in navigator);
    fetch(`${API_URL}/api/gps-verification/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setRecord(body))
      .catch(() => {});
  }, [author]);

  const verify = () => {
    setError(null);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`${API_URL}/api/gps-verification/${encodeURIComponent(author)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(body.error ?? "Failed to verify location");
          }
          setRecord(body);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to verify location");
        } finally {
          setBusy(false);
        }
      },
      () => {
        setError("Location permission denied — allow location access to verify.");
        setBusy(false);
      }
    );
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>GPS location verification (optional)</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Verify that your device&apos;s GPS location matches your network location. This is a real heuristic, not a
        guarantee — it can flag VPN use, but nothing can perfectly detect every case.
      </p>

      {!supported ? (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>Your browser doesn&apos;t support location access.</p>
      ) : (
        <button onClick={verify} disabled={busy} style={{ marginTop: 16 }}>
          {busy ? "Verifying…" : "Verify my location"}
        </button>
      )}

      {record && (record.verified || record.verifiedAt) && (
        <p style={{ marginTop: 12 }}>
          <strong>{record.verified ? "✅ Verified" : "⚠️ Not verified"}</strong>
          {record.distanceKm !== null && ` — ${record.distanceKm} km apart`}
          {record.reason && <><br />{record.reason}</>}
        </p>
      )}
      {error && <p style={{ color: "var(--color-danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </main>
  );
}
