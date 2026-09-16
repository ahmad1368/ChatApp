"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Bumble's real "Ability to limit daily app usage time" (#289) — see
 * usageTime.ts for the honest scoping (a disclosed reminder, not an OS-
 * level hard lockout this app has no way to actually enforce).
 */
export default function UsageLimitSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [options, setOptions] = useState<number[]>([]);
  const [limit, setLimit] = useState<number | null>(null);
  const [usageMinutesToday, setUsageMinutesToday] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/usage-limit/options`)
      .then((res) => res.json())
      .then((body) => setOptions(body.options ?? []))
      .catch(() => {});
    fetch(`${API_URL}/api/usage-limit/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setLimit(body.dailyLimitMinutes))
      .catch(() => {});
    fetch(`${API_URL}/api/usage-time/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setUsageMinutesToday(body.usageMinutesToday ?? 0))
      .catch(() => {});
  }, [author]);

  const choose = (next: number | null) => {
    setLimit(next);
    setStatus(null);
    fetch(`${API_URL}/api/usage-limit/${encodeURIComponent(author)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyLimitMinutes: next }),
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
      <h1>Daily usage limit</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Get a reminder once you've spent this much time in the app today. Used {usageMinutesToday} minute
        {usageMinutesToday === 1 ? "" : "s"} so far today.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="radio" name="limit" checked={limit === null} onChange={() => choose(null)} />
          No limit
        </label>
        {options.map((minutes) => (
          <label key={minutes} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="radio" name="limit" checked={limit === minutes} onChange={() => choose(minutes)} />
            {minutes} minutes a day
          </label>
        ))}
      </div>

      {status && <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 12 }}>{status}</p>}
    </main>
  );
}
