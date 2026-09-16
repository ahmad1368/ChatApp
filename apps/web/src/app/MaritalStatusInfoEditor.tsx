"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: "Single",
  divorced: "Divorced",
  widowed: "Widowed",
  separated: "Separated",
};

export default function MaritalStatusInfoEditor({ author }: { author: string }) {
  const [maritalStatus, setMaritalStatus] = useState("");
  const [hideMaritalStatus, setHideMaritalStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/marital-status-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setMaritalStatus(body.maritalStatusInfo?.maritalStatus ?? "");
        setHideMaritalStatus(body.maritalStatusInfo?.hideMaritalStatus ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/marital-status-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maritalStatus: maritalStatus || null, hideMaritalStatus }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save marital status");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save marital status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Previous marital status</h2>
      <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} style={{ width: "100%", marginTop: 4 }}>
        <option value="">Prefer not to say</option>
        {Object.entries(MARITAL_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideMaritalStatus} onChange={(e) => setHideMaritalStatus(e.target.checked)} />
        Hide marital status on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
