"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  billingPeriod: "monthly" | "yearly";
  features: string[];
}

/**
 * Bumble's real pricing page (#177) — lists whatever plans an admin has
 * published via /admin/pricing, plus a promo-code check. There's no real
 * checkout behind this (this app has no payment processor), so "Redeem"
 * only validates the code and records the usage rather than pretending
 * to charge a card — see discountCodes.ts.
 */
export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/pricing-plans`)
      .then((r) => r.json())
      .then((body) => setPlans(body.plans ?? []));
  }, []);

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    const res = await fetch(`${API_URL}/api/discount-codes/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setResult(body.error ?? "That code isn't valid");
      return;
    }
    setResult(`${body.code.amount}${body.code.type === "percent" ? "%" : "$"} off applied`);
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Pricing</h1>

      {plans.length === 0 && <p style={{ color: "var(--color-muted)" }}>No plans are available right now.</p>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {plans.map((plan) => (
          <div key={plan.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 16, flex: "1 1 200px" }}>
            <h2 style={{ fontSize: 18, marginTop: 0 }}>{plan.name}</h2>
            <p style={{ fontSize: 24, margin: "4px 0" }}>
              ${(plan.priceCents / 100).toFixed(2)}
              <span style={{ fontSize: 13, color: "var(--color-muted)" }}>/{plan.billingPeriod}</span>
            </p>
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <form onSubmit={redeem} style={{ display: "flex", gap: 8, marginTop: 24 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Have a promo code?"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={!code}>
          Redeem
        </button>
      </form>
      {result && <p style={{ marginTop: 8, fontSize: 13 }}>{result}</p>}
    </main>
  );
}
