"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_SELECTED_WEEKEND_PLANS = 5;

/**
 * Tinder/Hinge's "what are you up to this weekend" prompt (#119), same
 * fixed-catalog multi-select shape as InterestsInfoEditor.tsx.
 */
export default function WeekendPlansEditor({ author }: { author: string }) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hideWeekendPlans, setHideWeekendPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/weekend-plans/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/weekend-plans/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, infoBody]) => {
        setCatalog(catalogBody.weekendPlans ?? []);
        setSelected(infoBody.weekendPlansInfo?.weekendPlans ?? []);
        setHideWeekendPlans(infoBody.weekendPlansInfo?.hideWeekendPlans ?? false);
      })
      .catch(() => {});
  }, [author]);

  const toggle = (plan: string) => {
    setSelected((prev) => {
      if (prev.includes(plan)) return prev.filter((p) => p !== plan);
      if (prev.length >= MAX_SELECTED_WEEKEND_PLANS) return prev;
      return [...prev, plan];
    });
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/weekend-plans/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekendPlans: selected, hideWeekendPlans }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save weekend plans");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save weekend plans");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Weekend plans</h2>
      <p style={{ color: "var(--color-muted)" }}>What are you up to this weekend? Pick up to {MAX_SELECTED_WEEKEND_PLANS}.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {catalog.map((plan) => {
          const isSelected = selected.includes(plan);
          return (
            <button
              key={plan}
              onClick={() => toggle(plan)}
              disabled={!isSelected && selected.length >= MAX_SELECTED_WEEKEND_PLANS}
              style={{ textTransform: "capitalize", fontWeight: isSelected ? "bold" : "normal" }}
            >
              {plan}
            </button>
          );
        })}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input type="checkbox" checked={hideWeekendPlans} onChange={(e) => setHideWeekendPlans(e.target.checked)} />
        Hide weekend plans on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
