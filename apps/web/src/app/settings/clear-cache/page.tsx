"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";
import { clearAppCache } from "../../clearCache";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Feeld's real "Clear app cache" (#167) — see clearCache.ts for what
 * actually gets cleared (this PWA's real service-worker Cache Storage)
 * and what deliberately doesn't (localStorage settings, the browser's
 * own HTTP cache, which has no JS API to clear at all).
 */
export default function ClearCacheSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [lastClearedAt, setLastClearedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/cache-clear-log/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setLastClearedAt(body.lastClearedAt ?? null))
      .catch(() => {});
  }, [author]);

  const clear = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const count = await clearAppCache();
      const res = await fetch(`${API_URL}/api/cache-clear-log/${encodeURIComponent(author)}`, { method: "POST" });
      const body = await res.json();
      setLastClearedAt(body.clearedAt);
      setStatus(`Cleared ${count} cached ${count === 1 ? "entry" : "entries"}.`);
    } catch {
      setStatus("Failed to clear cache — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Clear app cache</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Removes cached app files stored on this device so the app re-downloads them fresh. This doesn't sign you out
        or change any of your settings.
      </p>
      {lastClearedAt && (
        <p style={{ fontSize: 13, color: "var(--color-muted)" }}>Last cleared: {new Date(lastClearedAt).toLocaleString()}</p>
      )}
      <button onClick={clear} disabled={busy} style={{ marginTop: 12 }}>
        {busy ? "Clearing…" : "Clear cache"}
      </button>
      {status && <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 12 }}>{status}</p>}
    </main>
  );
}
