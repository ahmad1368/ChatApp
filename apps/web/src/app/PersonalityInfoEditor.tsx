"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const MBTI_TYPES = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
];
const ENNEAGRAM_TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function PersonalityInfoEditor({ author }: { author: string }) {
  const [mbtiType, setMbtiType] = useState("");
  const [enneagramType, setEnneagramType] = useState("");
  const [hideMbti, setHideMbti] = useState(false);
  const [hideEnneagram, setHideEnneagram] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/personality-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setMbtiType(body.personalityInfo?.mbtiType ?? "");
        setEnneagramType(body.personalityInfo?.enneagramType != null ? String(body.personalityInfo.enneagramType) : "");
        setHideMbti(body.personalityInfo?.hideMbti ?? false);
        setHideEnneagram(body.personalityInfo?.hideEnneagram ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/personality-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mbtiType: mbtiType || null,
          enneagramType: enneagramType === "" ? null : Number(enneagramType),
          hideMbti,
          hideEnneagram,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save personality info");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save personality info");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Personality type</h2>
      <label style={{ display: "block", marginTop: 4 }}>
        MBTI
        <select value={mbtiType} onChange={(e) => setMbtiType(e.target.value)} style={{ width: "100%", marginTop: 2 }}>
          <option value="">Prefer not to say</option>
          {MBTI_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideMbti} onChange={(e) => setHideMbti(e.target.checked)} />
        Hide MBTI on my profile
      </label>

      <label style={{ display: "block", marginTop: 8 }}>
        Enneagram
        <select value={enneagramType} onChange={(e) => setEnneagramType(e.target.value)} style={{ width: "100%", marginTop: 2 }}>
          <option value="">Prefer not to say</option>
          {ENNEAGRAM_TYPES.map((type) => (
            <option key={type} value={type}>
              Type {type}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideEnneagram} onChange={(e) => setHideEnneagram(e.target.checked)} />
        Hide Enneagram on my profile
      </label>

      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
