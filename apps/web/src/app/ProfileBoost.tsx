"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const TIER_LABELS: Record<string, string> = { boost: "🚀 Boost", superboost: "⚡ Super Boost" };

interface BoostPackage {
  id: string;
  boosts: number;
  coinCost: number;
}

/**
 * Tinder's real "Boost"/"Super Boost" (#105, extended by #106): activating
 * puts this author at the front of everyone else's discovery order for 30
 * minutes, with Super Boost outranking a plain Boost — see profileBoost.ts
 * and swipes.ts's getCandidates for the ranking rule. The peak-hours hint
 * is #106's "smart" half: it tells the user when boosting will actually
 * reach the most people, based on real recorded swipe activity (see
 * peakHours.ts) rather than leaving them to guess. The buttons above stay
 * free, exactly as #105/#106 shipped them; #198's "Purchase a single
 * Boost or Boost package" adds the section below — a real coin-priced
 * package that credits a boost the "Use a boost credit" button then
 * draws down, the purchasable alternative real Tinder also has.
 */
export default function ProfileBoost({ author }: { author: string }) {
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [isPeakHourNow, setIsPeakHourNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<BoostPackage[]>([]);
  const [credits, setCredits] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval>>();

  const load = () => {
    fetch(`${API_URL}/api/profile-boost/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setExpiresAt(body.active ? body.expiresAt : null);
        setTier(body.active ? body.tier : null);
      })
      .catch(() => {});
  };

  const loadCredits = () => {
    fetch(`${API_URL}/api/profile-boost/${encodeURIComponent(author)}/credits`)
      .then((res) => res.json())
      .then((body) => setCredits(body.credits ?? 0))
      .catch(() => {});
  };

  useEffect(load, [author]);
  useEffect(loadCredits, [author]);

  useEffect(() => {
    fetch(`${API_URL}/api/profile-boost/packages`)
      .then((res) => res.json())
      .then((body) => setPackages(body.packages ?? []))
      .catch(() => {});
  }, []);

  const purchasePackage = async (packageId: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/profile-boost/${encodeURIComponent(author)}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to purchase boost package");
      setCredits(body.credits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to purchase boost package");
    } finally {
      setBusy(false);
    }
  };

  const activateWithCredit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/profile-boost/${encodeURIComponent(author)}/activate-with-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "boost" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to activate Boost");
      setExpiresAt(body.expiresAt);
      setTier(body.tier);
      loadCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate Boost");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    fetch(`${API_URL}/api/peak-hours`)
      .then((res) => res.json())
      .then((body) => setIsPeakHourNow(body.isPeakHourNow ?? false))
      .catch(() => {});
  }, [author]);

  useEffect(() => {
    clearInterval(tickRef.current);
    if (!expiresAt) {
      setRemainingMs(0);
      return;
    }
    const tick = () => setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickRef.current);
  }, [expiresAt]);

  const activate = async (selectedTier: "boost" | "superboost") => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/profile-boost/${encodeURIComponent(author)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to activate Boost");
      }
      setExpiresAt(body.expiresAt);
      setTier(body.tier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate Boost");
    } finally {
      setBusy(false);
    }
  };

  const active = remainingMs > 0;

  return (
    <div style={{ marginBottom: 12 }}>
      {active ? (
        <p>
          {tier ? TIER_LABELS[tier] : "🚀 Boosted"} active ({formatRemaining(remainingMs)})
        </p>
      ) : (
        <>
          {isPeakHourNow && (
            <p style={{ color: "var(--color-muted)", fontSize: 12 }}>
              🔥 Right now is a peak activity hour — a great time to boost.
            </p>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => activate("boost")} disabled={busy}>
              🚀 Boost my profile
            </button>
            <button onClick={() => activate("superboost")} disabled={busy}>
              ⚡ Super Boost
            </button>
          </div>
        </>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div style={{ marginTop: 12, fontSize: 12 }}>
        <p style={{ color: "var(--color-muted)", margin: "0 0 4px" }}>
          Or buy a boost package with coins — {credits} credit{credits === 1 ? "" : "s"} available
          {credits > 0 && !active && (
            <button onClick={activateWithCredit} disabled={busy} style={{ marginLeft: 8 }}>
              Use a credit
            </button>
          )}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {packages.map((p) => (
            <button key={p.id} onClick={() => purchasePackage(p.id)} disabled={busy}>
              {p.boosts} boost{p.boosts === 1 ? "" : "s"} · {p.coinCost} coins
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
