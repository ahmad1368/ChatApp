"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Subscription {
  author: string;
  tier: string;
  subscribedAt: string;
  expiresAt: string;
}

/**
 * Tinder's real "Premium subscription plans (Gold, Platinum, VIP)"
 * (#191) — the admin-facing view of who currently holds an active,
 * self-service subscription (see subscriptions.ts for why there's no
 * real charge behind it).
 */
export default function AdminSubscriptionsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/subscriptions`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load subscriptions");
      return;
    }
    setSubscriptions(body.subscriptions);
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Active subscriptions</h1>

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

      {subscriptions && subscriptions.length === 0 && <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No active subscribers.</p>}

      {subscriptions && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {subscriptions.map((s) => (
            <li key={s.author} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <strong>{s.author}</strong> — {s.tier}
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
                Subscribed {new Date(s.subscribedAt).toLocaleDateString()} · expires {new Date(s.expiresAt).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
