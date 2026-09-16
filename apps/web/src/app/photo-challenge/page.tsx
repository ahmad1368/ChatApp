"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Submission {
  id: string;
  author: string;
  photoId: string;
  votes: number;
}

/**
 * Hinge's real "Ability to participate in weekly photography challenges"
 * (#298) — a real, deterministically-rotating weekly theme (see
 * photoChallenge.ts), one submission per author per week, and one vote
 * per viewer per submission (never for your own). Submissions are picked
 * from the author's existing photo album rather than a separate upload
 * flow.
 */
export default function PhotoChallengePage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [theme, setTheme] = useState<string | null>(null);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSubmissions = () => {
    fetch(`${API_URL}/api/photo-challenge/submissions`)
      .then((res) => res.json())
      .then((body) => setSubmissions(body.submissions ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetch(`${API_URL}/api/photo-challenge/theme`)
      .then((res) => res.json())
      .then((body) => setTheme(body.theme))
      .catch(() => {});
    fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(author)}/photos`)
      .then((res) => res.json())
      .then((body) => setPhotoIds(body.photoIds ?? []))
      .catch(() => {});
    loadSubmissions();
  }, [author]);

  const submit = async () => {
    if (!selectedPhotoId) return;
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/photo-challenge/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, photoId: selectedPhotoId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to submit");
      }
      setStatus("Entry submitted!");
      loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  };

  const vote = async (submissionId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/photo-challenge/submissions/${submissionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter: author }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to vote");
      }
      setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? { ...s, votes: body.votes } : s)).sort((a, b) => b.votes - a.votes));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>
      <h1>📸 Weekly photo challenge</h1>
      {theme && (
        <p style={{ color: "var(--color-muted)" }}>
          This week&apos;s theme: <strong>{theme}</strong>
        </p>
      )}

      {photoIds.length > 0 && (
        <section style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13 }}>Pick a photo from your album to submit:</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {photoIds.map((id) => (
              <img
                key={id}
                src={`${API_URL}/api/photos/${id}?viewer=${encodeURIComponent(author)}`}
                alt="Album photo"
                onClick={() => setSelectedPhotoId(id)}
                style={{
                  width: 64,
                  height: 64,
                  objectFit: "cover",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: selectedPhotoId === id ? "2px solid var(--color-fg, #000)" : "1px solid var(--color-border)",
                }}
              />
            ))}
          </div>
          <button onClick={submit} disabled={busy || !selectedPhotoId} style={{ marginTop: 8 }}>
            Submit entry
          </button>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>This week&apos;s entries</h2>
        {submissions.length === 0 ? (
          <p style={{ color: "var(--color-muted)" }}>No entries yet — be the first!</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {submissions.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                <img
                  src={`${API_URL}/api/photos/${s.photoId}?viewer=${encodeURIComponent(author)}`}
                  alt={`${s.author}'s entry`}
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }}
                />
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: "bold", margin: 0 }}>{s.author}</p>
                  <p style={{ color: "var(--color-muted)", fontSize: 12, margin: 0 }}>{s.votes} votes</p>
                </div>
                <button onClick={() => vote(s.id)} disabled={s.author === author}>
                  👍
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {status && <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 12 }}>{status}</p>}
      {error && <p style={{ fontSize: 13, color: "var(--color-danger)", marginTop: 12 }}>{error}</p>}
    </main>
  );
}
