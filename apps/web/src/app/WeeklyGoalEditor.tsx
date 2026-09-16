"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_GOAL_LENGTH = 140;

/**
 * Tinder's real "Ability to define 'my goal this week' in the profile"
 * (#258) — same editable-anytime pattern as #65's BioEditor, but the
 * server (weeklyGoal.ts) genuinely resets this back to empty once the
 * real calendar week rolls over, so a stale goal from weeks ago never
 * lingers on a profile.
 */
export default function WeeklyGoalEditor({ author }: { author: string }) {
  const [goal, setGoal] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/weekly-goal/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setGoal(body.weeklyGoal?.goal ?? "");
        setSaved(body.weeklyGoal?.goal ?? "");
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/weekly-goal/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save this week's goal");
      }
      setGoal(body.weeklyGoal?.goal ?? "");
      setSaved(body.weeklyGoal?.goal ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save this week's goal");
    } finally {
      setBusy(false);
    }
  };

  const remaining = MAX_GOAL_LENGTH - goal.length;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>My goal this week</h2>
      <p style={{ color: "var(--color-muted)" }}>Resets automatically every week.</p>
      <input
        type="text"
        value={goal}
        onChange={(e) => setGoal(e.target.value.slice(0, MAX_GOAL_LENGTH))}
        placeholder="e.g. Go on 2 dates"
        maxLength={MAX_GOAL_LENGTH}
        style={{ width: "100%" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ color: "var(--color-muted)" }}>{remaining} characters left</span>
        <button onClick={save} disabled={busy || goal === saved}>
          Save goal
        </button>
      </div>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
