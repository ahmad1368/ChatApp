"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Experiment {
  id: string;
  name: string;
  variants: string[];
  active: boolean;
  createdAt: string;
}

/**
 * Hinge's real "A/B testing support for algorithm changes" (#188) —
 * see experiments.ts for the honest scoping (real deterministic
 * per-user bucketing and real assignment counts; no algorithm is
 * wired to branch on a variant yet).
 */
export default function AdminExperimentsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [stats, setStats] = useState<Record<string, Record<string, number>>>({});
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [variantsText, setVariantsText] = useState("control, treatment");

  const load = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/experiments`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load experiments");
      return;
    }
    setExperiments(body.experiments);
    for (const experiment of body.experiments as Experiment[]) {
      loadStats(experiment.id);
    }
  };

  const loadStats = async (experimentId: string) => {
    const res = await fetch(`${API_URL}/api/admin/experiments/${experimentId}/stats`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setStats((prev) => ({ ...prev, [experimentId]: body.stats }));
  };

  const createExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const variants = variantsText
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const res = await fetch(`${API_URL}/api/admin/experiments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ name, variants }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to create experiment");
      return;
    }
    setName("");
    load();
  };

  const toggleActive = async (experiment: Experiment) => {
    await fetch(`${API_URL}/api/admin/experiments/${experiment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ active: !experiment.active }),
    });
    load();
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>A/B experiments</h1>

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

      <form onSubmit={createExperiment} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 20 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>New experiment</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Ranking algorithm v2)"
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <input
          type="text"
          value={variantsText}
          onChange={(e) => setVariantsText(e.target.value)}
          placeholder="Variants, comma-separated"
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <button type="submit" disabled={!adminKey || !name}>
          Create experiment
        </button>
      </form>

      {experiments && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {experiments.map((experiment) => (
            <li key={experiment.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <p style={{ margin: 0 }}>
                <strong>{experiment.name}</strong> {!experiment.active && "(inactive)"}
              </p>
              <p style={{ margin: "4px 0", fontSize: 13, color: "var(--color-muted)" }}>
                {experiment.variants
                  .map((v) => `${v}: ${stats[experiment.id]?.[v] ?? 0}`)
                  .join(" · ")}
              </p>
              <button onClick={() => toggleActive(experiment)}>{experiment.active ? "Deactivate" : "Activate"}</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
