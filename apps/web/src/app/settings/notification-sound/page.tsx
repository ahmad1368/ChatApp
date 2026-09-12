"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";
import { playRingtone, RingtoneId } from "../../notificationSound";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const RINGTONES: { id: RingtoneId; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "chime", label: "Chime" },
  { id: "pop", label: "Pop" },
  { id: "silent", label: "Silent" },
];

/**
 * Tinder's real "Custom ringtone and vibration for app notifications"
 * (#160). Honestly split in two: "Ringtone" here previews and picks a
 * real, synthesized-in-browser tone (see notificationSound.ts) that only
 * ever plays while this tab is open and foreground — the Push API has no
 * cross-browser way to attach a custom sound to a system-level
 * notification, so there is no "background ringtone" to offer here.
 * "Vibration" is the genuinely real half: turning it off is honored by
 * the actual push payload server.ts sends for new matches/likes/expiry
 * reminders, so it also silences the OS-level vibration when the app
 * isn't focused (see apps/api/src/notificationSound.ts).
 */
export default function NotificationSoundSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [ringtone, setRingtone] = useState<RingtoneId>("default");
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/notification-sound/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!body?.preference) return;
        setRingtone(body.preference.ringtone);
        setVibrationEnabled(body.preference.vibrationEnabled);
      })
      .catch(() => {});
  }, [author]);

  const save = (updates: { ringtone?: RingtoneId; vibrationEnabled?: boolean }) => {
    setStatus(null);
    fetch(`${API_URL}/api/notification-sound/${encodeURIComponent(author)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("Saved.");
      })
      .catch(() => setStatus("Failed to save — please try again."));
  };

  const chooseRingtone = (id: RingtoneId) => {
    setRingtone(id);
    playRingtone(id);
    save({ ringtone: id });
  };

  const toggleVibration = () => {
    const next = !vibrationEnabled;
    setVibrationEnabled(next);
    save({ vibrationEnabled: next });
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Ringtone &amp; vibration</h1>

      <h2 style={{ fontSize: 15, marginTop: 24 }}>Ringtone</h2>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Plays only while ChatApp is open in this tab — the browser doesn't let a website attach a custom sound to a
        system notification.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {RINGTONES.map(({ id, label }) => (
          <label key={id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="radio" name="ringtone" checked={ringtone === id} onChange={() => chooseRingtone(id)} />
            {label}
            {id !== "silent" && (
              <button type="button" onClick={() => playRingtone(id)} style={{ fontSize: 12 }}>
                Preview
              </button>
            )}
          </label>
        ))}
      </div>

      <h2 style={{ fontSize: 15, marginTop: 24 }}>Vibration</h2>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input type="checkbox" checked={vibrationEnabled} onChange={toggleVibration} />
        Vibrate for new matches, likes, and reminders — including while the app is in the background
      </label>

      {status && <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 12 }}>{status}</p>}
    </main>
  );
}
