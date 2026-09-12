"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface FunnelStage {
  key: string;
  label: string;
  count: number;
  conversionFromStart: number;
  conversionFromPrevious: number;
}

/**
 * Bumble's real "Tools to analyze user behavior and conversion rate"
 * (#179) — a real signup → onboarding → first-swipe → first-match →
 * first-message funnel, and a real 24h active-user count, both computed
 * from this app's own stores (see analyticsFunnel.ts). Single-series bar
 * chart, so no legend box is needed — the title names what's plotted;
 * a table view sits alongside it so the numbers are never chart-only.
 */
export default function AdminAnalyticsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [funnel, setFunnel] = useState<FunnelStage[] | null>(null);
  const [dailyActiveUsers, setDailyActiveUsers] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const load = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/analytics/funnel`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load analytics");
      setFunnel(null);
      return;
    }
    setFunnel(body.funnel);
    setDailyActiveUsers(body.dailyActiveUsers);
  };

  const maxCount = funnel ? Math.max(1, ...funnel.map((s) => s.count)) : 1;

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>User behavior & conversion</h1>

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

      {dailyActiveUsers !== null && (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: 12,
            background: "var(--color-panel)",
            marginTop: 20,
            maxWidth: 200,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--color-muted)" }}>Active in last 24h</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{dailyActiveUsers.toLocaleString()}</div>
        </div>
      )}

      {funnel && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 24 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Conversion funnel</h2>
            <button onClick={() => setShowTable((v) => !v)} style={{ fontSize: 12 }}>
              {showTable ? "Show chart" : "Show table"}
            </button>
          </div>

          {!showTable && (
            <div role="img" aria-label="Funnel chart of signup through first-message conversion" style={{ marginTop: 12 }}>
              {funnel.map((stage) => {
                const widthPercent = (stage.count / maxCount) * 100;
                return (
                  <div key={stage.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 140, fontSize: 13, color: "var(--color-text)" }}>{stage.label}</span>
                    <div style={{ flex: 1, background: "var(--color-border)", borderRadius: 4, height: 22 }}>
                      <div
                        title={`${stage.label}: ${stage.count.toLocaleString()} (${stage.conversionFromStart}% of signups)`}
                        style={{
                          width: `${widthPercent}%`,
                          minWidth: stage.count > 0 ? 4 : 0,
                          height: "100%",
                          background: "var(--chart-series-1)",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span style={{ width: 130, fontSize: 12, textAlign: "right", color: "var(--color-muted)" }}>
                      {stage.count.toLocaleString()} ({stage.conversionFromStart}%)
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {showTable && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)", padding: 6 }}>Stage</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid var(--color-border)", padding: 6 }}>Count</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid var(--color-border)", padding: 6 }}>% of signups</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid var(--color-border)", padding: 6 }}>% of previous</th>
                </tr>
              </thead>
              <tbody>
                {funnel.map((stage) => (
                  <tr key={stage.key}>
                    <td style={{ padding: 6 }}>{stage.label}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>{stage.count.toLocaleString()}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>{stage.conversionFromStart}%</td>
                    <td style={{ padding: 6, textAlign: "right" }}>{stage.conversionFromPrevious}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  );
}
