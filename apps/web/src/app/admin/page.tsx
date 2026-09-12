"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AdminMetrics {
  totalUsers: number;
  totalMatches: number;
  totalMessages: number;
  totalReports: number;
  totalBlocks: number;
}

const BARS: { key: keyof AdminMetrics; label: string; color: string }[] = [
  { key: "totalUsers", label: "Users", color: "var(--chart-series-1)" },
  { key: "totalMatches", label: "Matches", color: "var(--chart-series-2)" },
  { key: "totalMessages", label: "Messages", color: "var(--chart-series-3)" },
  { key: "totalReports", label: "Reports", color: "var(--chart-series-4)" },
  { key: "totalBlocks", label: "Blocks", color: "var(--chart-series-5)" },
];

/**
 * Tinder's real "Comprehensive admin dashboard with analytical charts"
 * (#171) — see apps/api/src/adminMetrics.ts for the honest scoping (real
 * live counts, a single shared admin key rather than full RBAC). The key
 * is entered client-side and sent as the `x-admin-key` header on every
 * request; nothing is persisted, so refreshing the page clears it.
 */
export default function AdminDashboardPage() {
  const [adminKey, setAdminKey] = useState("");
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/metrics`, { headers: { "x-admin-key": adminKey } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to load metrics");
        setMetrics(null);
        return;
      }
      setMetrics(body.metrics);
    } catch {
      setError("Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  const maxValue = metrics ? Math.max(1, ...BARS.map((bar) => metrics[bar.key])) : 1;

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Admin dashboard</h1>
      <p>
        <Link href="/admin/photos">Photo review queue &rarr;</Link>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadMetrics();
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
        <button type="submit" disabled={loading || !adminKey}>
          {loading ? "Loading…" : "Load metrics"}
        </button>
      </form>

      {error && <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{error}</p>}

      {metrics && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginBottom: 24 }}>
            {BARS.map((bar) => (
              <div
                key={bar.key}
                style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, background: "var(--color-panel)" }}
              >
                <div style={{ fontSize: 13, color: "var(--color-muted)" }}>{bar.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{metrics[bar.key].toLocaleString()}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 15 }}>Totals compared</h2>
          <div role="img" aria-label="Bar chart comparing total users, matches, messages, reports, and blocks">
            {BARS.map((bar) => {
              const value = metrics[bar.key];
              const widthPercent = (value / maxValue) * 100;
              return (
                <div key={bar.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 90, fontSize: 13, color: "var(--color-text)" }}>{bar.label}</span>
                  <div style={{ flex: 1, background: "var(--color-border)", borderRadius: 4, height: 20 }}>
                    <div
                      title={`${bar.label}: ${value.toLocaleString()}`}
                      style={{
                        width: `${widthPercent}%`,
                        minWidth: value > 0 ? 4 : 0,
                        height: "100%",
                        background: bar.color,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span style={{ width: 60, fontSize: 13, textAlign: "right", color: "var(--color-muted)" }}>
                    {value.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
