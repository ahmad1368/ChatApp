"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STARS = [1, 2, 3, 4, 5];

const ISSUE_LABELS: Record<string, string> = {
  audioCutOut: "Audio cut out",
  videoFroze: "Video froze",
  echoOrNoise: "Echo or noise",
  connectionDropped: "Connection dropped",
  delay: "Delay/lag",
};

/**
 * Badoo's real "System to record feedback on voice/video call quality"
 * (#309) — shown once a call that actually connected ends (see
 * ChatRoom.tsx's teardownCall), asking for a star rating, real technical
 * issue tags, and optional free text.
 */
export default function CallQualityFeedbackPrompt({ callId, author, onClose }: { callId: string; author: string; onClose: () => void }) {
  const [issueOptions, setIssueOptions] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/call-quality-feedback/issues`)
      .then((res) => res.json())
      .then((body) => setIssueOptions(body.issues ?? []))
      .catch(() => {});
  }, []);

  const toggleIssue = (issue: string) => {
    setSelectedIssues((prev) => (prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]));
  };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/call-quality-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, author, rating, issues: selectedIssues, comment }),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 8, fontSize: 13 }}>
        <p style={{ margin: 0 }}>Thanks for the feedback!</p>
        <button onClick={onClose} style={{ marginTop: 6 }}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 8, fontSize: 13 }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700 }}>How was the call quality?</p>
      <div style={{ marginBottom: 8 }}>
        {STARS.map((s) => (
          <button key={s} onClick={() => setRating(s)} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>
            {s <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {issueOptions.map((issue) => (
          <button
            key={issue}
            onClick={() => toggleIssue(issue)}
            style={{
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 12,
              border: selectedIssues.includes(issue) ? "1px solid var(--color-accent, #e0245e)" : "1px solid var(--color-border)",
              background: selectedIssues.includes(issue) ? "var(--color-accent-muted, rgba(224,36,94,0.12))" : "none",
              cursor: "pointer",
            }}
          >
            {ISSUE_LABELS[issue] ?? issue}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything else? (optional)"
        maxLength={500}
        style={{ width: "100%", minHeight: 40, fontSize: 13, marginBottom: 8 }}
      />
      <div>
        <button onClick={submit} disabled={busy || rating === 0}>
          Submit
        </button>
        <button onClick={onClose} disabled={busy} style={{ marginLeft: 6 }}>
          Skip
        </button>
      </div>
    </div>
  );
}
