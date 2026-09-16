"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ProfilePreview {
  bio?: string;
  jobTitle?: string;
  interests?: string[];
  [key: string]: unknown;
}

/**
 * The friend's read of Tinder's real "Ability to share a profile with a
 * friend for their opinion" (#264) — no account needed, same shape as
 * /share-my-date/shared/[code]. Fetches the candidate's own public
 * profile-preview (#81) and lets the friend leave a reaction and comment.
 */
export default function SharedProfilePage({ params }: { params: { code: string } }) {
  const [candidateAuthor, setCandidateAuthor] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProfilePreview | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [commenterName, setCommenterName] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/profile-shares/shared/${params.code}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((body) => setCandidateAuthor(body.share.candidateAuthor))
      .catch(() => setNotFound(true));
  }, [params.code]);

  useEffect(() => {
    if (!candidateAuthor) return;
    fetch(`${API_URL}/api/profile-preview/${encodeURIComponent(candidateAuthor)}`)
      .then((res) => res.json())
      .then((body) => setPreview(body.preview ?? {}))
      .catch(() => {});
  }, [candidateAuthor]);

  const submit = async (reaction: "like" | "pass") => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/profile-shares/shared/${params.code}/opinions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commenterName, reaction, comment }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to submit your opinion");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit your opinion");
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>A friend wants your opinion</h1>
      {notFound && <p>This link is invalid.</p>}
      {!notFound && !candidateAuthor && <p>Loading…</p>}
      {candidateAuthor && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
          <p style={{ fontWeight: "bold", fontSize: 18 }}>{candidateAuthor}</p>
          {preview?.bio && <p>{preview.bio}</p>}
          {preview?.jobTitle && <p>{preview.jobTitle}</p>}
          {preview?.interests && preview.interests.length > 0 && <p>Interests: {preview.interests.join(", ")}</p>}
          {submitted ? (
            <p>Thanks for weighing in!</p>
          ) : (
            <div style={{ marginTop: 12 }}>
              <input
                type="text"
                value={commenterName}
                onChange={(e) => setCommenterName(e.target.value)}
                placeholder="Your name"
                style={{ width: "100%", marginBottom: 6 }}
              />
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Your thoughts (optional)"
                rows={2}
                style={{ width: "100%", marginBottom: 6 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => submit("like")} disabled={!commenterName.trim()}>
                  👍 Like
                </button>
                <button onClick={() => submit("pass")} disabled={!commenterName.trim()}>
                  👎 Pass
                </button>
              </div>
              {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
