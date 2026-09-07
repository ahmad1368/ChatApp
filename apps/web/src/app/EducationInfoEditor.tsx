"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_LENGTH = 100;

export default function EducationInfoEditor({ author }: { author: string }) {
  const [school, setSchool] = useState("");
  const [hideSchool, setHideSchool] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/education-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setSchool(body.educationInfo?.school ?? "");
        setHideSchool(body.educationInfo?.hideSchool ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/education-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, hideSchool }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save education info");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save education info");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Education</h2>
      <input
        type="text"
        value={school}
        onChange={(e) => setSchool(e.target.value.slice(0, MAX_LENGTH))}
        placeholder="School or university"
        maxLength={MAX_LENGTH}
        style={{ width: "100%", marginTop: 4 }}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideSchool} onChange={(e) => setHideSchool(e.target.checked)} />
        Hide school name on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
