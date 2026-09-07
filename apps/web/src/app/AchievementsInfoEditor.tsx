"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_ACHIEVEMENTS = 5;

interface Achievement {
  title: string;
  issuer: string;
  year: number | null;
}

const EMPTY_ACHIEVEMENT: Achievement = { title: "", issuer: "", year: null };

export default function AchievementsInfoEditor({ author }: { author: string }) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [hideAchievements, setHideAchievements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/achievements-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setAchievements(body.achievementsInfo?.achievements ?? []);
        setHideAchievements(body.achievementsInfo?.hideAchievements ?? false);
      })
      .catch(() => {});
  }, [author]);

  const updateEntry = (index: number, patch: Partial<Achievement>) => {
    setAchievements((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const addEntry = () => {
    if (achievements.length >= MAX_ACHIEVEMENTS) return;
    setAchievements((prev) => [...prev, { ...EMPTY_ACHIEVEMENT }]);
  };

  const removeEntry = (index: number) => {
    setAchievements((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/achievements-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          achievements: achievements.filter((a) => a.title.trim()),
          hideAchievements,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save achievements");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save achievements");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Achievements</h2>
      <p style={{ color: "var(--color-muted)" }}>Degrees, certifications, awards — up to {MAX_ACHIEVEMENTS}.</p>
      {achievements.map((entry, i) => (
        <div key={i} style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <input
            type="text"
            value={entry.title}
            onChange={(e) => updateEntry(i, { title: e.target.value })}
            placeholder="Title"
            style={{ flex: 2 }}
          />
          <input
            type="text"
            value={entry.issuer}
            onChange={(e) => updateEntry(i, { issuer: e.target.value })}
            placeholder="Issuer"
            style={{ flex: 2 }}
          />
          <input
            type="number"
            value={entry.year ?? ""}
            onChange={(e) => updateEntry(i, { year: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="Year"
            style={{ flex: 1 }}
          />
          <button onClick={() => removeEntry(i)}>✕</button>
        </div>
      ))}
      {achievements.length < MAX_ACHIEVEMENTS && (
        <button onClick={addEntry} style={{ marginTop: 4 }}>
          Add achievement
        </button>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <input type="checkbox" checked={hideAchievements} onChange={(e) => setHideAchievements(e.target.checked)} />
        Hide achievements on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
