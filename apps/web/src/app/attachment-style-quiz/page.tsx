"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface QuizQuestion {
  id: string;
  text: string;
  dimension: "anxiety" | "avoidance";
}

interface QuizResult {
  style: "secure" | "anxious" | "avoidant" | "fearful";
  anxietyScore: number;
  avoidanceScore: number;
  hideResult: boolean;
  completedAt: string;
}

const STYLE_LABELS: Record<QuizResult["style"], string> = {
  secure: "Secure",
  anxious: "Anxious",
  avoidant: "Avoidant",
  fearful: "Fearful-avoidant",
};

const SCALE = [1, 2, 3, 4, 5];

/**
 * eHarmony's real "psychological tendencies based on tests" (#315) — a
 * real, in-app attachment-style quiz (see attachmentStyleQuiz.ts for the
 * scoring). Deliberately not a "mental health status" display: this is a
 * lightweight self-reflection tool, not a diagnosis, and is disclosed as
 * such here.
 */
export default function AttachmentStyleQuizPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [hideResult, setHideResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/attachment-style-quiz/questions`)
      .then((res) => res.json())
      .then((body) => setQuestions(body.questions ?? []))
      .catch(() => {});
    fetch(`${API_URL}/api/attachment-style-quiz/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setResult(body.result ?? null))
      .catch(() => {});
  }, [author]);

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const orderedAnswers = questions.map((q) => answers[q.id]);
      const res = await fetch(`${API_URL}/api/attachment-style-quiz/${encodeURIComponent(author)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: orderedAnswers, hideResult }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to submit quiz");
      setResult(body.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Attachment style quiz</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        A short self-reflection quiz on how you tend to relate to romantic partners. This is not a mental health
        assessment or diagnosis — just a lightweight relationship-style indicator, private by default.
      </p>

      {result && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 16 }}>
          <p style={{ fontWeight: 700, margin: 0 }}>Your style: {STYLE_LABELS[result.style]}</p>
          <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 0" }}>
            Retake the quiz below any time — your result updates.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {questions.map((q) => (
          <div key={q.id}>
            <p style={{ fontSize: 13, margin: "0 0 4px" }}>{q.text}</p>
            <div style={{ display: "flex", gap: 6 }}>
              {SCALE.map((value) => (
                <button
                  key={value}
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: answers[q.id] === value ? "1px solid var(--color-accent, #e0245e)" : "1px solid var(--color-border)",
                    background: answers[q.id] === value ? "var(--color-accent-muted, rgba(224,36,94,0.12))" : "none",
                    cursor: "pointer",
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {questions.length > 0 && (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13 }}>
            <input type="checkbox" checked={hideResult} onChange={(e) => setHideResult(e.target.checked)} />
            Keep my result private
          </label>
          <button onClick={submit} disabled={busy || !allAnswered} style={{ marginTop: 8 }}>
            {busy ? "Submitting…" : "Submit"}
          </button>
        </>
      )}

      {error && <p style={{ color: "var(--color-danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </main>
  );
}
