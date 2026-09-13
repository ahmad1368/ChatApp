"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface RetentionWindow {
  windowDays: number;
  eligibleUsers: number;
  retainedUsers: number;
  retentionRate: number;
}

/**
 * Bumble's real "View user retention rate" (#189) — see retention.ts
 * for the honest scoping (signup-to-return computed from UserStore and
 * TokenService, the one place those share an authenticated identity).
 */
export default function AdminRetentionPage() {
  const [adminKey, setAdminKey] = useState("");
  const [windows, setWindows] = useState<RetentionWindow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/retention`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load retention");
      return;
    }
    setWindows(body.windows);
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>User retention</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        style={{ display: "flex", gap: 8, marginTop: 16 }}
      >
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Admin key"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={!adminKey}>
          Load
        </button>
      </form>

      {error && <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{error}</p>}

      {windows && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 20 }}>
          {windows.map((w) => (
            <div key={w.windowDays} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, background: "var(--color-panel)" }}>
              <div style={{ fontSize: 13, color: "var(--color-muted)" }}>Day {w.windowDays} retention</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{(w.retentionRate * 100).toFixed(1)}%</div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
                {w.retainedUsers} of {w.eligibleUsers} eligible
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
