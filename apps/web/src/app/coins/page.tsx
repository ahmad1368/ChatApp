"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface CoinPackage {
  id: string;
  coins: number;
  priceCents: number;
}

/**
 * Coffee Meets Bagel's real "Purchase in-app coin/token packages"
 * (#196) — see coins.ts for the honest scoping (a real balance backing
 * a fixed, curated package catalog; "Buy" credits it immediately since
 * this app has no payment processor to charge against yet).
 */
export default function CoinsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadBalance = () => {
    fetch(`${API_URL}/api/coins/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setBalance(body.balance ?? 0))
      .catch(() => {});
  };

  useEffect(() => {
    fetch(`${API_URL}/api/coins/packages`)
      .then((res) => res.json())
      .then((body) => setPackages(body.packages ?? []))
      .catch(() => {});
    loadBalance();
  }, [author]);

  const buy = async (packageId: string) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/coins/${encodeURIComponent(author)}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to purchase");
      return;
    }
    setBalance(body.balance);
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link> &middot; <Link href="/daily-spin">Daily Spin</Link>
      </p>
      <h1>Coins</h1>
      <p style={{ fontSize: 24, fontWeight: 700 }}>{balance} coins</p>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {packages.map((p) => (
          <div key={p.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 16, flex: "1 1 130px" }}>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{p.coins} coins</p>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "4px 0 12px" }}>${(p.priceCents / 100).toFixed(2)}</p>
            <button onClick={() => buy(p.id)}>Buy</button>
          </div>
        ))}
      </div>
    </main>
  );
}
