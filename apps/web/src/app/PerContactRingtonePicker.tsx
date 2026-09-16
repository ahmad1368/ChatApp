"use client";

import { useEffect, useState } from "react";
import { playRingtone, RingtoneId } from "./notificationSound";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const RINGTONES: { id: RingtoneId; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "chime", label: "Chime" },
  { id: "pop", label: "Pop" },
  { id: "silent", label: "Silent" },
];

/**
 * Tinder's real "Ability to customize the chat notification sound per
 * person" (#292) — an override on top of #160's global default ringtone
 * for one specific match, using the "Uses your default" empty option to
 * mean "no override" (clears back to the global setting) — see
 * perContactRingtone.ts.
 */
export default function PerContactRingtonePicker({ viewer, contact }: { viewer: string; contact: string }) {
  const [ringtone, setRingtone] = useState<RingtoneId | "">("");

  useEffect(() => {
    fetch(`${API_URL}/api/notification-sound/${encodeURIComponent(viewer)}/contact/${encodeURIComponent(contact)}`)
      .then((res) => res.json())
      .then((body) => setRingtone(body.ringtone ?? ""))
      .catch(() => {});
  }, [viewer, contact]);

  const choose = (next: RingtoneId | "") => {
    setRingtone(next);
    if (next) playRingtone(next);
    fetch(`${API_URL}/api/notification-sound/${encodeURIComponent(viewer)}/contact/${encodeURIComponent(contact)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ringtone: next || null }),
    }).catch(() => {});
  };

  return (
    <select
      value={ringtone}
      onChange={(e) => choose(e.target.value as RingtoneId | "")}
      aria-label={`Notification sound for ${contact}`}
      style={{ fontSize: 12 }}
    >
      <option value="">Uses your default</option>
      {RINGTONES.map((r) => (
        <option key={r.id} value={r.id}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
