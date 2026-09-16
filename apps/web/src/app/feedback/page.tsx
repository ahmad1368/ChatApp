"use client";

import { useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CATEGORIES: { id: string; label: string }[] = [
  { id: "bug", label: "Something's broken" },
  { id: "featureRequest", label: "Feature idea" },
  { id: "general", label: "General feedback" },
];

/**
 * Bumble's real "Ability to send direct feedback to the development
 * team" (#294) — a one-way note to the team, distinct from #180's
 * two-way support tickets. See feedback.ts.
 */
export default function FeedbackPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, category, message }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to send feedback");
      }
      setMessage("");
      setStatus("Thanks! Your feedback was sent to the team.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send feedback");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Send feedback</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Tell the development team what's working, what's broken, or what you'd like to see.
      </p>

      <form onSubmit={submit} style={{ marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {CATEGORIES.map((c) => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="radio" name="category" checked={category === c.id} onChange={() => setCategory(c.id)} />
              {c.label}
            </label>
          ))}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Your feedback..."
          rows={5}
          maxLength={2000}
          style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
        />
        <button type="submit" disabled={busy || !message.trim()} style={{ marginTop: 8 }}>
          Send
        </button>
      </form>

      {status && <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 12 }}>{status}</p>}
      {error && <p style={{ fontSize: 13, color: "var(--color-danger)", marginTop: 12 }}>{error}</p>}
    </main>
  );
}
