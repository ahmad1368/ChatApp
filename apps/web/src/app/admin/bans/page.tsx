"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type BanMode = "banned" | "shadowbanned";
type BanType = "temporary" | "permanent";

interface BanEntry {
  userId: string;
  mode: BanMode;
  type?: BanType;
  reason: string;
  bannedBy: string;
  bannedAt: string;
  expiresAt: string | null;
}

/**
 * Bumble's real "Ability to permanently or temporarily ban offending
 * users (Ban / Shadowban)" (#175). A ban is a visible, hard block on
 * swiping/messaging; a shadowban silently removes the account from
 * discovery while it keeps working normally — see bans.ts for why that
 * boundary is drawn there.
 */
export default function AdminBansPage() {
  const [adminKey, setAdminKey] = useState("");
  const [bans, setBans] = useState<BanEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [targetUserId, setTargetUserId] = useState("");
  const [mode, setMode] = useState<BanMode>("banned");
  const [type, setType] = useState<BanType>("temporary");
  const [durationHours, setDurationHours] = useState("24");
  const [reason, setReason] = useState("");

  const loadBans = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/bans`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load bans");
      setBans(null);
      return;
    }
    setBans(body.bans);
  };

  const applyBan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/bans/${encodeURIComponent(targetUserId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({
        mode,
        reason,
        bannedBy: "admin",
        type: mode === "banned" ? type : undefined,
        durationHours: mode === "banned" && type === "temporary" ? Number(durationHours) : undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to apply ban");
      return;
    }
    setTargetUserId("");
    setReason("");
    loadBans();
  };

  const lift = async (userId: string) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/bans/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to lift ban");
      return;
    }
    setBans((prev) => prev?.filter((entry) => entry.userId !== userId) ?? null);
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Ban / shadowban queue</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadBans();
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
          Load active bans
        </button>
      </form>

      {error && <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{error}</p>}

      <form
        onSubmit={applyBan}
        style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 20 }}
      >
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Issue a ban</h2>
        <input
          type="text"
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
          placeholder="User ID"
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <select value={mode} onChange={(e) => setMode(e.target.value as BanMode)} style={{ padding: 8, marginRight: 8 }}>
          <option value="banned">Ban</option>
          <option value="shadowbanned">Shadowban</option>
        </select>
        {mode === "banned" && (
          <select value={type} onChange={(e) => setType(e.target.value as BanType)} style={{ padding: 8, marginRight: 8 }}>
            <option value="temporary">Temporary</option>
            <option value="permanent">Permanent</option>
          </select>
        )}
        {mode === "banned" && type === "temporary" && (
          <input
            type="number"
            min={1}
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            placeholder="Duration (hours)"
            style={{ padding: 8, width: 140 }}
          />
        )}
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          style={{ width: "100%", padding: 8, margin: "8px 0", boxSizing: "border-box" }}
        />
        <button type="submit" disabled={!targetUserId || !reason}>
          Apply
        </button>
      </form>

      {bans && bans.length === 0 && <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No active bans.</p>}

      {bans && bans.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {bans.map((entry) => (
            <li
              key={entry.userId}
              style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}
            >
              <p style={{ margin: 0 }}>
                <strong>{entry.userId}</strong> — {entry.mode === "banned" ? `${entry.type} ban` : "shadowban"}
              </p>
              <p style={{ margin: "4px 0", fontSize: 13, color: "var(--color-muted)" }}>
                {entry.reason} — by {entry.bannedBy} on {new Date(entry.bannedAt).toLocaleString()}
                {entry.expiresAt && ` — expires ${new Date(entry.expiresAt).toLocaleString()}`}
              </p>
              <button onClick={() => lift(entry.userId)}>Lift</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
