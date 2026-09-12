"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ExploreTheme {
  id: string;
  name: string;
  interests: string[];
  active: boolean;
}

/**
 * Bumble's real "Full control over Explore section content and
 * hashtags" (#182) — admin CRUD for #99's Explore Mode theme catalog.
 * "Hashtags" here are #79's fixed interest-tag catalog (see
 * exploreThemes.ts for why there's no separate free-text tag system).
 */
export default function AdminExploreThemesPage() {
  const [adminKey, setAdminKey] = useState("");
  const [themes, setThemes] = useState<ExploreTheme[] | null>(null);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/interests-info/catalog`)
      .then((res) => res.json())
      .then((body) => setCatalog(body.interests ?? []))
      .catch(() => {});
  }, []);

  const load = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/explore-themes`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load themes");
      return;
    }
    setThemes(body.themes);
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) => (prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]));
  };

  const createTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/explore-themes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ name, interests: selectedInterests }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to create theme");
      return;
    }
    setName("");
    setSelectedInterests([]);
    load();
  };

  const deactivate = async (themeId: string) => {
    await fetch(`${API_URL}/api/admin/explore-themes/${themeId}`, {
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
      <h1>Explore themes</h1>

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

      <form onSubmit={createTheme} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 20 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>New theme</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Theme name (e.g. Book Lovers)"
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {catalog.map((interest) => (
            <button
              type="button"
              key={interest}
              onClick={() => toggleInterest(interest)}
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid var(--color-border)",
                background: selectedInterests.includes(interest) ? "var(--chart-series-1)" : "transparent",
                color: selectedInterests.includes(interest) ? "#fff" : "var(--color-text)",
              }}
            >
              {interest}
            </button>
          ))}
        </div>
        <button type="submit" disabled={!name || selectedInterests.length === 0} style={{ marginTop: 10 }}>
          Create theme
        </button>
      </form>

      {themes && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {themes.map((theme) => (
            <li key={theme.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <p style={{ margin: 0 }}>
                <strong>{theme.name}</strong>
                {!theme.active && " (inactive)"}
              </p>
              <p style={{ margin: "4px 0", fontSize: 13, color: "var(--color-muted)" }}>{theme.interests.join(", ")}</p>
              {theme.active && <button onClick={() => deactivate(theme.id)}>Deactivate</button>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
