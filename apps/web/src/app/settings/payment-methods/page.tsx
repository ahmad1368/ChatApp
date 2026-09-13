"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const PAYMENT_METHOD_TYPES = ["card", "bank"] as const;

interface PaymentMethod {
  id: string;
  type: (typeof PAYMENT_METHOD_TYPES)[number];
  brand: string;
  last4: string;
  isDefault: boolean;
}

/**
 * Raya's real "In-app credit/bank payment gateway" (#192) — see
 * paymentMethods.ts for the honest scoping. This never asks for a full
 * card or account number: only a brand (e.g. "Visa") and the last 4
 * digits, the same shape a real Stripe Elements/Plaid Link integration
 * would return to this app after tokenizing the real number elsewhere
 * — there's no actual charge network call behind "Add", since this
 * environment has no payment processor credentialed.
 */
export default function PaymentMethodsSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<(typeof PAYMENT_METHOD_TYPES)[number]>("card");
  const [brand, setBrand] = useState("");
  const [last4, setLast4] = useState("");

  const load = () => {
    fetch(`${API_URL}/api/payment-methods/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setMethods(body.methods ?? []))
      .catch(() => {});
  };

  useEffect(load, [author]);

  const addMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/api/payment-methods/${encodeURIComponent(author)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, brand, last4 }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to add payment method");
      return;
    }
    setBrand("");
    setLast4("");
    load();
  };

  const setDefault = async (methodId: string) => {
    await fetch(`${API_URL}/api/payment-methods/${encodeURIComponent(author)}/${methodId}/default`, { method: "PUT" });
    load();
  };

  const remove = async (methodId: string) => {
    await fetch(`${API_URL}/api/payment-methods/${encodeURIComponent(author)}/${methodId}`, { method: "DELETE" });
    load();
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Payment methods</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Only a card/bank brand and its last 4 digits are ever stored here — never a full number.
      </p>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {methods.map((m) => (
        <div
          key={m.id}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}
        >
          <span>
            {m.brand} •••• {m.last4} {m.isDefault && "(default)"}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            {!m.isDefault && <button onClick={() => setDefault(m.id)}>Make default</button>}
            <button onClick={() => remove(m.id)}>Remove</button>
          </span>
        </div>
      ))}

      <form onSubmit={addMethod} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Add a payment method</h2>
        <select value={type} onChange={(e) => setType(e.target.value as (typeof PAYMENT_METHOD_TYPES)[number])} style={{ width: "100%", padding: 8, marginBottom: 8 }}>
          {PAYMENT_METHOD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "card" ? "Credit/debit card" : "Bank account"}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Brand (e.g. Visa, Chase)"
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <input
          type="text"
          value={last4}
          onChange={(e) => setLast4(e.target.value)}
          placeholder="Last 4 digits"
          maxLength={4}
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <button type="submit" disabled={!brand || last4.length !== 4}>
          Add
        </button>
      </form>
    </main>
  );
}
