"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface DateReview {
  didMeet: boolean;
  rating: number | null;
  feedback: string;
}

/**
 * Hinge's real "We Met" confidential post-date feedback (#263) — shown
 * per match on /matches, same "visible only to you" reasoning as #95's
 * SmartScoreDisplay: what you submit here is never shown to the other
 * person, only readable back by you.
 */
export default function DateReviewPrompt({ author, candidate }: { author: string; candidate: string }) {
  const [review, setReview] = useState<DateReview | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [didMeet, setDidMeet] = useState<boolean | null>(null);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/date-reviews/${encodeURIComponent(author)}/${encodeURIComponent(candidate)}`)
      .then((res) => res.json())
      .then((body) => setReview(body.review ?? null))
      .catch(() => {});
  }, [author, candidate]);

  const submit = async (met: boolean) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/date-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer: author,
          reviewedAuthor: candidate,
          didMeet: met,
          rating: met ? rating : undefined,
          feedback,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to submit feedback");
      }
      setReview(body.review);
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setBusy(false);
    }
  };

  if (review) {
    return (
      <p style={{ color: "var(--color-muted)", fontSize: 12 }}>
        {review.didMeet ? `✅ You rated this date ${review.rating}/5 (private)` : "You noted you didn't meet up (private)"}
      </p>
    );
  }

  if (!expanded) {
    return (
      <button className="chat-app__link-button" onClick={() => setExpanded(true)} style={{ fontSize: 12 }}>
        Rate your date (confidential)
      </button>
    );
  }

  return (
    <div style={{ fontSize: 12, marginTop: 4 }}>
      {didMeet === null ? (
        <div style={{ display: "flex", gap: 8 }}>
          <span>Did you meet up?</span>
          <button onClick={() => setDidMeet(true)} disabled={busy}>
            Yes
          </button>
          <button onClick={() => submit(false)} disabled={busy}>
            No
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label>
            Rating (1-5)
            <input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} style={{ marginLeft: 6, width: 48 }} />
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Private notes (optional)"
            rows={2}
          />
          <button onClick={() => submit(true)} disabled={busy} style={{ alignSelf: "flex-start" }}>
            Submit (confidential)
          </button>
        </div>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
