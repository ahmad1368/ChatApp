"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  billingPeriod: "monthly" | "yearly";
  features: string[];
  active: boolean;
}

interface DiscountCode {
  code: string;
  type: "percent" | "fixed";
  amount: number;
  redemptionCount: number;
  maxRedemptions: number | null;
  active: boolean;
}

/**
 * Bumble's real "Manage financial plans, pricing and discount codes"
 * (#177). This app has no real payment processor, so a plan is
 * informational pricing data an admin curates, not a live billing
 * product — see pricingPlans.ts/discountCodes.ts for the honest scoping.
 */
export default function AdminPricingPage() {
  const [adminKey, setAdminKey] = useState("");
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [codes, setCodes] = useState<DiscountCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planPeriod, setPlanPeriod] = useState<"monthly" | "yearly">("monthly");
  const [planFeatures, setPlanFeatures] = useState("");

  const [codeName, setCodeName] = useState("");
  const [codeType, setCodeType] = useState<"percent" | "fixed">("percent");
  const [codeAmount, setCodeAmount] = useState("");

  const authHeaders = { "x-admin-key": adminKey };

  const loadAll = async () => {
    setError(null);
    const [plansRes, codesRes] = await Promise.all([
      fetch(`${API_URL}/api/admin/pricing-plans`, { headers: authHeaders }),
      fetch(`${API_URL}/api/admin/discount-codes`, { headers: authHeaders }),
    ]);
    if (!plansRes.ok || !codesRes.ok) {
      setError("Failed to load pricing data");
      return;
    }
    setPlans((await plansRes.json()).plans);
    setCodes((await codesRes.json()).codes);
  };

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/pricing-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        name: planName,
        priceCents: Math.round(Number(planPrice) * 100),
        billingPeriod: planPeriod,
        features: planFeatures
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
      }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to create plan");
      return;
    }
    setPlanName("");
    setPlanPrice("");
    setPlanFeatures("");
    loadAll();
  };

  const archivePlan = async (planId: string) => {
    await fetch(`${API_URL}/api/admin/pricing-plans/${planId}`, { method: "DELETE", headers: authHeaders });
    loadAll();
  };

  const createCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/discount-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ code: codeName, type: codeType, amount: Number(codeAmount) }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to create code");
      return;
    }
    setCodeName("");
    setCodeAmount("");
    loadAll();
  };

  const deactivateCode = async (code: string) => {
    await fetch(`${API_URL}/api/admin/discount-codes/${code}`, { method: "DELETE", headers: authHeaders });
    loadAll();
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Pricing plans & discount codes</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadAll();
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

      <form onSubmit={createPlan} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 20 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>New pricing plan</h2>
        <input
          type="text"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          placeholder="Plan name (e.g. Gold)"
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={planPrice}
          onChange={(e) => setPlanPrice(e.target.value)}
          placeholder="Price (dollars)"
          style={{ padding: 8, marginRight: 8, width: 140 }}
        />
        <select value={planPeriod} onChange={(e) => setPlanPeriod(e.target.value as "monthly" | "yearly")} style={{ padding: 8 }}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input
          type="text"
          value={planFeatures}
          onChange={(e) => setPlanFeatures(e.target.value)}
          placeholder="Features, comma-separated"
          style={{ width: "100%", padding: 8, margin: "8px 0", boxSizing: "border-box" }}
        />
        <button type="submit" disabled={!planName || !planPrice}>
          Create plan
        </button>
      </form>

      {plans && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {plans.map((plan) => (
            <li key={plan.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <p style={{ margin: 0 }}>
                <strong>{plan.name}</strong> — ${(plan.priceCents / 100).toFixed(2)}/{plan.billingPeriod}
                {!plan.active && " (archived)"}
              </p>
              {plan.features.length > 0 && (
                <p style={{ margin: "4px 0", fontSize: 13, color: "var(--color-muted)" }}>{plan.features.join(", ")}</p>
              )}
              {plan.active && <button onClick={() => archivePlan(plan.id)}>Archive</button>}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={createCode} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 20 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>New discount code</h2>
        <input
          type="text"
          value={codeName}
          onChange={(e) => setCodeName(e.target.value)}
          placeholder="Code (e.g. SAVE20)"
          style={{ padding: 8, marginRight: 8 }}
        />
        <select value={codeType} onChange={(e) => setCodeType(e.target.value as "percent" | "fixed")} style={{ padding: 8, marginRight: 8 }}>
          <option value="percent">% off</option>
          <option value="fixed">$ off</option>
        </select>
        <input
          type="number"
          min="0"
          value={codeAmount}
          onChange={(e) => setCodeAmount(e.target.value)}
          placeholder="Amount"
          style={{ padding: 8, width: 100 }}
        />
        <div style={{ marginTop: 8 }}>
          <button type="submit" disabled={!codeName || !codeAmount}>
            Create code
          </button>
        </div>
      </form>

      {codes && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {codes.map((code) => (
            <li key={code.code} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <p style={{ margin: 0 }}>
                <strong>{code.code}</strong> — {code.amount}
                {code.type === "percent" ? "%" : "$"} off — {code.redemptionCount}
                {code.maxRedemptions !== null ? `/${code.maxRedemptions}` : ""} redeemed
                {!code.active && " (deactivated)"}
              </p>
              {code.active && <button onClick={() => deactivateCode(code.code)}>Deactivate</button>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
