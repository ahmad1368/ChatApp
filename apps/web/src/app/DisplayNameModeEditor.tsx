"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_NICKNAME_LENGTH = 40;

const MODE_LABELS: Record<string, string> = {
  fullName: "Full name",
  firstNameOnly: "First name only",
  initials: "Initials",
  nickname: "Nickname",
};

export default function DisplayNameModeEditor({ author }: { author: string }) {
  const [modes, setModes] = useState<string[]>([]);
  const [mode, setMode] = useState("fullName");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/display-name-mode/modes`).then((res) => res.json()),
      fetch(`${API_URL}/api/display-name-mode/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([modesBody, prefBody]) => {
        setModes(modesBody.modes ?? []);
        setMode(prefBody.preference?.mode ?? "fullName");
        setNickname(prefBody.preference?.nickname ?? "");
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/display-name-mode/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, nickname }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save display name preference");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save display name preference");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>How your name is shown</h2>
      <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: "100%", marginTop: 4 }}>
        {modes.map((m) => (
          <option key={m} value={m}>
            {MODE_LABELS[m] ?? m}
          </option>
        ))}
      </select>
      {mode === "nickname" && (
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value.slice(0, MAX_NICKNAME_LENGTH))}
          placeholder="Nickname"
          maxLength={MAX_NICKNAME_LENGTH}
          style={{ width: "100%", marginTop: 4 }}
        />
      )}
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
