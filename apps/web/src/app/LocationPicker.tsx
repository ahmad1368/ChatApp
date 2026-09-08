"use client";

import { useState } from "react";

export interface LocationSharePayload {
  latitude: number;
  longitude: number;
  label?: string;
  live: boolean;
  durationMinutes?: number;
}

/**
 * WhatsApp/Bumble's real "send live or text location" (#127): "text"
 * location is a one-time pin with an optional text label; "live" keeps
 * updating for the chosen duration (see ChatRoom.tsx's live-share
 * tracking loop and liveLocationShares.ts's server-side bound).
 */
export default function LocationPicker({
  onSend,
  onClose,
}: {
  onSend: (payload: LocationSharePayload) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [duration, setDuration] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const getPosition = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location isn't supported in this browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Location permission denied")), {
        enableHighAccuracy: true,
      });
    });

  const send = async (live: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const position = await getPosition();
      onSend({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        label: label.trim() || undefined,
        live,
        durationMinutes: live ? duration : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get your location");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-app__location-picker">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Add a label (optional)"
        className="chat-app__input"
      />
      <div className="chat-app__location-picker-actions">
        <button onClick={() => send(false)} disabled={busy}>
          📍 Send current location
        </button>
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} disabled={busy}>
          <option value={15}>15 min</option>
          <option value={60}>1 hour</option>
          <option value={480}>8 hours</option>
        </select>
        <button onClick={() => send(true)} disabled={busy}>
          🔴 Share live location
        </button>
        <button onClick={onClose}>✕</button>
      </div>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
