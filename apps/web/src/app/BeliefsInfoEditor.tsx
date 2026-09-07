"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const RELIGION_LABELS: Record<string, string> = {
  agnostic: "Agnostic",
  atheist: "Atheist",
  buddhist: "Buddhist",
  catholic: "Catholic",
  christian: "Christian",
  hindu: "Hindu",
  jewish: "Jewish",
  muslim: "Muslim",
  sikh: "Sikh",
  spiritual: "Spiritual",
  other: "Other",
};

const POLITICAL_VIEW_LABELS: Record<string, string> = {
  liberal: "Liberal",
  moderate: "Moderate",
  conservative: "Conservative",
  notPolitical: "Not political",
  other: "Other",
};

export default function BeliefsInfoEditor({ author }: { author: string }) {
  const [religion, setReligion] = useState("");
  const [politicalView, setPoliticalView] = useState("");
  const [hideReligion, setHideReligion] = useState(false);
  const [hidePoliticalView, setHidePoliticalView] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/beliefs-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setReligion(body.beliefsInfo?.religion ?? "");
        setPoliticalView(body.beliefsInfo?.politicalView ?? "");
        setHideReligion(body.beliefsInfo?.hideReligion ?? false);
        setHidePoliticalView(body.beliefsInfo?.hidePoliticalView ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/beliefs-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          religion: religion || null,
          politicalView: politicalView || null,
          hideReligion,
          hidePoliticalView,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save beliefs info");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save beliefs info");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Religion &amp; politics</h2>
      <label style={{ display: "block", marginTop: 4 }}>
        Religion
        <select value={religion} onChange={(e) => setReligion(e.target.value)} style={{ width: "100%", marginTop: 2 }}>
          <option value="">Prefer not to say</option>
          {Object.entries(RELIGION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideReligion} onChange={(e) => setHideReligion(e.target.checked)} />
        Hide religion on my profile
      </label>

      <label style={{ display: "block", marginTop: 8 }}>
        Political views
        <select
          value={politicalView}
          onChange={(e) => setPoliticalView(e.target.value)}
          style={{ width: "100%", marginTop: 2 }}
        >
          <option value="">Prefer not to say</option>
          {Object.entries(POLITICAL_VIEW_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hidePoliticalView} onChange={(e) => setHidePoliticalView(e.target.checked)} />
        Hide political views on my profile
      </label>

      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
