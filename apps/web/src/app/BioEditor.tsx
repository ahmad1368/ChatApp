"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_BIO_LENGTH = 280;

export default function BioEditor({ author }: { author: string }) {
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/bio/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setBio(body.bio ?? "");
        setSaved(body.bio ?? "");
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/bio/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save bio");
      }
      setSaved(body.bio ?? bio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bio");
    } finally {
      setBusy(false);
    }
  };

  const remaining = MAX_BIO_LENGTH - bio.length;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Bio</h2>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
        placeholder="Say a little about yourself"
        rows={3}
        maxLength={MAX_BIO_LENGTH}
        style={{ width: "100%", resize: "vertical" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ color: remaining < 0 ? "var(--color-danger)" : "var(--color-muted)" }}>
          {remaining} characters left
        </span>
        <button onClick={save} disabled={busy || bio === saved}>
          Save bio
        </button>
      </div>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
