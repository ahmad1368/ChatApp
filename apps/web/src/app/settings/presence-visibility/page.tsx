"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Preference {
  showOnlineStatus: boolean;
  showLastActive: boolean;
}

/**
 * Tinder's real "Settings for how online/offline status is displayed"
 * (#161) — WhatsApp/Bumble's actual online-status/last-seen privacy pair,
 * layered on top of #110's real presence tracking (see
 * presenceVisibility.ts). Turning off "Show when I was last active" also
 * hides everyone else's last-active time from you — the same mutual
 * trade WhatsApp's real Last Seen setting makes, not a one-way toggle.
 */
export default function PresenceVisibilitySettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [preference, setPreference] = useState<Preference>({ showOnlineStatus: true, showLastActive: true });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/presence-visibility/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => body?.preference && setPreference(body.preference))
      .catch(() => {});
  }, [author]);

  const toggle = (key: keyof Preference) => {
    const next = { ...preference, [key]: !preference[key] };
    setPreference(next);
    setStatus(null);
    fetch(`${API_URL}/api/presence-visibility/${encodeURIComponent(author)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
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
      <h1>Online status</h1>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, marginTop: 16 }}>
        <input
          type="checkbox"
          checked={preference.showOnlineStatus}
          onChange={() => toggle("showOnlineStatus")}
          style={{ marginTop: 3 }}
        />
        <span>
          <strong>Show when I'm online</strong>
          <br />
          <span style={{ color: "var(--color-muted)", fontSize: 13 }}>
            Others see a green "online now" indicator on your profile.
          </span>
        </span>
      </label>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, marginTop: 16 }}>
        <input
          type="checkbox"
          checked={preference.showLastActive}
          onChange={() => toggle("showLastActive")}
          style={{ marginTop: 3 }}
        />
        <span>
          <strong>Show when I was last active</strong>
          <br />
          <span style={{ color: "var(--color-muted)", fontSize: 13 }}>
            If you turn this off, you also won't be able to see when other people were last active — same trade-off
            as WhatsApp's Last Seen setting.
          </span>
        </span>
      </label>

      {status && <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 12 }}>{status}</p>}
    </main>
  );
}
