"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const SUBSCRIPTION_TIERS = ["gold", "platinum", "vip"] as const;

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  billingPeriod: "monthly" | "yearly";
  features: string[];
}

interface Subscription {
  tier: (typeof SUBSCRIPTION_TIERS)[number];
  expiresAt: string;
  isTrial: boolean;
}

/**
 * Bumble's real pricing page (#177) — lists whatever plans an admin has
 * published via /admin/pricing, plus a promo-code check. There's no real
 * checkout behind this (this app has no payment processor), so "Redeem"
 * only validates the code and records the usage rather than pretending
 * to charge a card — see discountCodes.ts. The Premium section below is
 * #191's real named-tier subscription (Gold/Platinum/VIP) — see
 * subscriptions.ts for why "Subscribe" activates immediately instead of
 * charging anything. #202's free trial is a real, once-per-author 3-day
 * period that just lapses on its own rather than auto-converting to a
 * real charge, since there's nothing to charge. #204's referral system
 * gives both sides real free subscription days on redemption — see
 * referrals.ts.
 */
export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [author, setAuthor] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [trialEligible, setTrialEligible] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [friendCode, setFriendCode] = useState("");
  const [referralResult, setReferralResult] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/pricing-plans`)
      .then((r) => r.json())
      .then((body) => setPlans(body.plans ?? []));
  }, []);

  const loadSubscription = async () => {
    const res = await fetch(`${API_URL}/api/subscriptions/${encodeURIComponent(author)}`);
    const body = await res.json().catch(() => ({}));
    setSubscription(body.subscription ?? null);
    const eligibleRes = await fetch(`${API_URL}/api/subscriptions/${encodeURIComponent(author)}/trial-eligible`);
    const eligibleBody = await eligibleRes.json().catch(() => ({}));
    setTrialEligible(eligibleBody.eligible ?? false);
    const referralRes = await fetch(`${API_URL}/api/referrals/${encodeURIComponent(author)}/code`);
    const referralBody = await referralRes.json().catch(() => ({}));
    setReferralCode(referralBody.code ?? null);
    setReferralCount(referralBody.referralCount ?? 0);
  };

  // #204's referral system: redeeming a friend's real, unique code
  // credits real #191 subscription days to both sides via
  // SubscriptionStore.extendOrGrant() (see referrals.ts).
  const redeemReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    setReferralResult(null);
    const res = await fetch(`${API_URL}/api/referrals/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: friendCode, author }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setReferralResult(body.error ?? "That referral code isn't valid");
      return;
    }
    setFriendCode("");
    setReferralResult("You both got free subscription days!");
    loadSubscription();
  };

  const subscribe = async (tier: (typeof SUBSCRIPTION_TIERS)[number]) => {
    await fetch(`${API_URL}/api/subscriptions/${encodeURIComponent(author)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    loadSubscription();
  };

  const startTrial = async (tier: (typeof SUBSCRIPTION_TIERS)[number]) => {
    await fetch(`${API_URL}/api/subscriptions/${encodeURIComponent(author)}/trial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    loadSubscription();
  };

  const cancelSubscription = async () => {
    await fetch(`${API_URL}/api/subscriptions/${encodeURIComponent(author)}`, { method: "DELETE" });
    setSubscription(null);
  };

  // #203's upgrade coupon — unlike the price-discount codes below, this
  // actually grants a real subscription (see upgradeCoupons.ts).
  const redeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponResult(null);
    const res = await fetch(`${API_URL}/api/upgrade-coupons/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, author }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCouponResult(body.error ?? "That coupon isn't valid");
      return;
    }
    setCouponCode("");
    setCouponResult(`Upgraded to ${body.subscription.tier}!`);
    loadSubscription();
  };

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

      <h1 style={{ marginTop: 32 }}>Premium</h1>
      <input
        type="text"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        onBlur={loadSubscription}
        placeholder="Your name"
        style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
      />

      {subscription ? (
        <p>
          You're subscribed to <strong>{subscription.tier}</strong>
          {subscription.isTrial && " (free trial)"} until {new Date(subscription.expiresAt).toLocaleDateString()}.{" "}
          <button onClick={cancelSubscription}>Cancel</button>
        </p>
      ) : (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {SUBSCRIPTION_TIERS.map((tier) => (
            <div key={tier} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 16, flex: "1 1 150px" }}>
              <h2 style={{ fontSize: 18, marginTop: 0, textTransform: "capitalize" }}>{tier}</h2>
              <button onClick={() => subscribe(tier)} disabled={!author}>
                Subscribe
              </button>
              {trialEligible && (
                <button onClick={() => startTrial(tier)} disabled={!author} style={{ display: "block", marginTop: 6, fontSize: 12 }}>
                  Start 3-day free trial
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={redeemCoupon} style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input
          type="text"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="Have an upgrade coupon?"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={!couponCode || !author}>
          Redeem
        </button>
      </form>
      {couponResult && <p style={{ marginTop: 8, fontSize: 13 }}>{couponResult}</p>}

      {author && (
        <div style={{ marginTop: 24, border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Invite friends</h2>
          {referralCode && (
            <p style={{ fontSize: 13 }}>
              Your referral code: <strong>{referralCode}</strong> — {referralCount} friend{referralCount === 1 ? "" : "s"} referred so far.
              Each redemption gives you both free subscription days.
            </p>
          )}
          <form onSubmit={redeemReferral} style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              type="text"
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value)}
              placeholder="Have a friend's referral code?"
              style={{ flex: 1, padding: 8 }}
            />
            <button type="submit" disabled={!friendCode}>
              Redeem
            </button>
          </form>
          {referralResult && <p style={{ marginTop: 8, fontSize: 13 }}>{referralResult}</p>}
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 13 }}>
        <Link href="/settings/payment-methods">Manage your saved payment methods &rarr;</Link>
      </p>
    </main>
  );
}
