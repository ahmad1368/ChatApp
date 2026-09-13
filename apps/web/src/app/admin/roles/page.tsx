"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ROLES = ["superadmin", "moderator", "support", "finance"] as const;

interface AdminAccount {
  id: string;
  name: string;
  role: (typeof ROLES)[number];
  createdAt: string;
  revoked: boolean;
}

/**
 * Bumble's real "Manage admin access roles (RBAC)" (#187) — see
 * adminRoles.ts for the honest scoping (the master admin key you enter
 * below always acts as superadmin; a created account's own key only
 * has whatever access its role grants).
 */
export default function AdminRolesPage() {
  const [adminKey, setAdminKey] = useState("");
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("moderator");

  const load = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/roles`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load admin accounts");
      return;
    }
    setAccounts(body.accounts);
  };

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNewlyCreatedKey(null);
    const res = await fetch(`${API_URL}/api/admin/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ name, role }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to create admin account");
      return;
    }
    setNewlyCreatedKey(body.apiKey);
    setName("");
    load();
  };

  const revoke = async (accountId: string) => {
    await fetch(`${API_URL}/api/admin/roles/${accountId}`, {
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
      <h1>Admin access roles</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)" }}>
        Create named admin accounts with a limited role and their own API key, instead of sharing the master admin
        key. The master key always acts as superadmin.
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

      {newlyCreatedKey && (
        <p style={{ marginTop: 12, wordBreak: "break-all" }}>
          New account&apos;s API key (shown once — copy it now): <code>{newlyCreatedKey}</code>
        </p>
      )}

      <form onSubmit={createAccount} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 20 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>New admin account</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])} style={{ width: "100%", padding: 8, marginBottom: 8 }}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!adminKey || !name}>
          Create account
        </button>
      </form>

      {accounts && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {accounts.map((account) => (
            <li key={account.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <p style={{ margin: 0 }}>
                <strong>{account.name}</strong> &middot; {account.role}
                {account.revoked && " (revoked)"}
              </p>
              <p style={{ margin: "4px 0", fontSize: 12, color: "var(--color-muted)" }}>{new Date(account.createdAt).toLocaleString()}</p>
              {!account.revoked && <button onClick={() => revoke(account.id)}>Revoke</button>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
