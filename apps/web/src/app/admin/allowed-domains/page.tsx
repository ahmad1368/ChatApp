"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Bumble's real "Manage domains and website access" (#184) — admin CRUD
 * for the CORS allowlist enforced server-side (see allowedDomains.ts).
 * An empty list means every origin is allowed, so this page starts
 * empty rather than pre-seeded.
 */
export default function AdminAllowedDomainsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [origins, setOrigins] = useState<string[] | null>(null);
  const [newOrigin, setNewOrigin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/allowed-domains`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load allowed domains");
      return;
    }
    setOrigins(body.origins);
  };

  const addOrigin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/allowed-domains`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ origin: newOrigin }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to add domain");
      return;
    }
    setNewOrigin("");
    load();
  };

  const removeOrigin = async (origin: string) => {
    await fetch(`${API_URL}/api/admin/allowed-domains/${encodeURIComponent(origin)}`, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey },
    });
    load();
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Allowed domains</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)" }}>
        Restricts which website origins may call this API (CORS). While this list is empty, every origin is allowed —
        adding the first entry starts enforcing the allowlist.
      </p>

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

      <form onSubmit={addOrigin} style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <input
          type="text"
          value={newOrigin}
          onChange={(e) => setNewOrigin(e.target.value)}
          placeholder="https://example.com"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={!adminKey || !newOrigin}>
          Add domain
        </button>
      </form>

      {origins && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {origins.length === 0 && <li style={{ color: "var(--color-muted)", fontSize: 13 }}>No domains added — every origin is currently allowed.</li>}
          {origins.map((origin) => (
            <li
              key={origin}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <span>{origin}</span>
              <button onClick={() => removeOrigin(origin)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
