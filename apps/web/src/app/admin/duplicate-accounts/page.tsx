"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Cluster {
  signal: "ipAddress" | "deviceFingerprint";
  userIds: string[];
}

const SIGNAL_LABEL: Record<Cluster["signal"], string> = {
  ipAddress: "Shared network address",
  deviceFingerprint: "Shared device",
};

/**
 * Tinder's real "Smart detection of multiple accounts created from one
 * device" (#181) — the admin review queue for duplicateAccounts.ts's
 * detection engine (#53). Neither the raw IP nor device fingerprint is
 * ever exposed here, only the accounts a real shared signal linked —
 * see that file's doc comment for why this can flag false positives
 * (shared wifi, a new phone) and is a review signal, not proof.
 */
export default function AdminDuplicateAccountsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/duplicate-accounts`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load clusters");
      setClusters(null);
      return;
    }
    setClusters(body.clusters);
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Multi-account detection</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)" }}>
        Accounts grouped by a shared signal — a heads-up for review, not proof of abuse.
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

      {clusters && clusters.length === 0 && <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No flagged clusters.</p>}

      {clusters && clusters.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {clusters.map((cluster, index) => (
            <li key={index} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <p style={{ margin: 0 }}>
                <strong>{SIGNAL_LABEL[cluster.signal]}</strong> — {cluster.userIds.length} accounts
              </p>
              <p style={{ margin: "4px 0", fontSize: 13, color: "var(--color-muted)" }}>{cluster.userIds.join(", ")}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
