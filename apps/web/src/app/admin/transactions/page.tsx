"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Transaction {
  id: string;
  author: string;
  type: "purchase" | "refund";
  amountCents: number;
  description: string;
  createdAt: string;
  relatedTransactionId?: string;
  refundedAt?: string;
  refundReason?: string;
}

function formatCents(amountCents: number): string {
  return `${amountCents < 0 ? "-" : ""}$${(Math.abs(amountCents) / 100).toFixed(2)}`;
}

/**
 * Tinder's real "Detailed logging of all financial transactions and
 * refunds" (#185) — see transactionLog.ts for the honest scoping (a
 * manual admin ledger, since this app has no integrated payment
 * processor yet).
 */
export default function AdminTransactionsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [author, setAuthor] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [description, setDescription] = useState("");
  const [refundReasons, setRefundReasons] = useState<Record<string, string>>({});

  const load = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/transactions`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load transactions");
      return;
    }
    setTransactions(body.transactions);
  };

  const logPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ author, amountCents: Math.round(Number(amountDollars) * 100), description }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to log transaction");
      return;
    }
    setAuthor("");
    setAmountDollars("");
    setDescription("");
    load();
  };

  const refund = async (transactionId: string) => {
    const reason = refundReasons[transactionId]?.trim();
    if (!reason) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/transactions/${transactionId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ reason }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to refund transaction");
      return;
    }
    setRefundReasons((prev) => ({ ...prev, [transactionId]: "" }));
    load();
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Financial transactions</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)" }}>
        A manual ledger of payments and refunds — this app has no integrated payment processor yet, so purchases
        actually processed out-of-band are recorded here for audit purposes.
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

      <form onSubmit={logPurchase} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 20 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Log a purchase</h2>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="User"
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
          placeholder="Amount ($)"
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (e.g. Gold plan, monthly)"
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <button type="submit" disabled={!adminKey || !author || !amountDollars || !description}>
          Log purchase
        </button>
      </form>

      {transactions && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {transactions.map((t) => (
            <li key={t.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <p style={{ margin: 0 }}>
                <strong>{t.author}</strong> &middot; {t.type} &middot; {formatCents(t.amountCents)}
              </p>
              <p style={{ margin: "4px 0", fontSize: 13, color: "var(--color-muted)" }}>{t.description}</p>
              <p style={{ margin: "4px 0", fontSize: 12, color: "var(--color-muted)" }}>{new Date(t.createdAt).toLocaleString()}</p>
              {t.type === "purchase" && !t.refundedAt && (
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <input
                    type="text"
                    value={refundReasons[t.id] ?? ""}
                    onChange={(e) => setRefundReasons((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    placeholder="Refund reason"
                    style={{ flex: 1, padding: 6 }}
                  />
                  <button onClick={() => refund(t.id)} disabled={!refundReasons[t.id]?.trim()}>
                    Refund
                  </button>
                </div>
              )}
              {t.refundedAt && <span style={{ fontSize: 12, color: "var(--color-muted)" }}>Refunded: {t.refundReason}</span>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
