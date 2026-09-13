"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ServerHealth {
  uptimeSeconds: number;
  activeSockets: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Bumble's real "View server health status and active sockets" (#186)
 * — genuine process uptime/memory and a live Socket.io connection
 * count (see server.ts's /api/admin/server-health), gated the same
 * admin-key way as #171-185.
 */
export default function AdminServerHealthPage() {
  const [adminKey, setAdminKey] = useState("");
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/server-health`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load server health");
      return;
    }
    setHealth(body);
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Server health</h1>

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

      {health && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 20 }}>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, background: "var(--color-panel)" }}>
            <div style={{ fontSize: 13, color: "var(--color-muted)" }}>Uptime</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{formatUptime(health.uptimeSeconds)}</div>
          </div>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, background: "var(--color-panel)" }}>
            <div style={{ fontSize: 13, color: "var(--color-muted)" }}>Active sockets</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{health.activeSockets}</div>
          </div>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, background: "var(--color-panel)" }}>
            <div style={{ fontSize: 13, color: "var(--color-muted)" }}>Heap used</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{formatBytes(health.memory.heapUsed)}</div>
          </div>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, background: "var(--color-panel)" }}>
            <div style={{ fontSize: 13, color: "var(--color-muted)" }}>RSS</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{formatBytes(health.memory.rss)}</div>
          </div>
        </div>
      )}
    </main>
  );
}
