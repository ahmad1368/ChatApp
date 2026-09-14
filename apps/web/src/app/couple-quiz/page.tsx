"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
}

interface QuizResultView {
  questions: QuizQuestion[];
  participants: [string, string];
  myAnswers: Record<string, string> | null;
  bothSubmitted: boolean;
  theirAnswers: Record<string, string> | null;
  matchPercentage: number | null;
}

/**
 * Hinge's real "Two-person quiz to compare views before chatting"
 * (#215) — see coupleQuiz.ts for the honest scoping (a private per-pair
 * session that only reveals both sides' answers and an agreement
 * percentage once both participants have submitted).
 */
export default function CoupleQuizPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [partner, setPartner] = useState("");
  const [quizId, setQuizId] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResultView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const loadResult = (id: string) => {
    fetch(`${API_URL}/api/couple-quiz/${id}?author=${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then(setResult)
      .catch(() => {});
  };

  useEffect(() => {
    if (quizId) loadResult(quizId);
  }, [quizId]);

  const start = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/couple-quiz/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initiator: author, invitee: partner }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to start quiz");
      return;
    }
    setQuizId(body.quizId);
  };

  const submit = async () => {
    if (!quizId) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/couple-quiz/${quizId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, answers }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to submit answers");
      return;
    }
    loadResult(quizId);
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Two-Person Quiz</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {!quizId && (
        <div style={{ display: "flex", gap: 8 }}>
          <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="Partner's name" style={{ flex: 1 }} />
          <button onClick={start} disabled={!partner.trim()}>
            Start quiz
          </button>
        </div>
      )}

      {result && result.myAnswers === null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          {result.questions.map((q) => (
            <div key={q.id}>
              <p style={{ fontWeight: 700, margin: "0 0 8px" }}>{q.question}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {q.options.map((option) => (
                  <label key={option.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === option.id}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: option.id }))}
                    />
                    {option.text}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button onClick={submit} disabled={Object.keys(answers).length < result.questions.length}>
            Submit answers
          </button>
        </div>
      )}

      {result && result.myAnswers !== null && !result.bothSubmitted && (
        <p style={{ marginTop: 16 }}>Waiting for the other person to answer...</p>
      )}

      {result && result.bothSubmitted && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 24, fontWeight: 700 }}>{result.matchPercentage}% match</p>
          {result.questions.map((q) => (
            <div key={q.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <p style={{ fontWeight: 700, margin: 0 }}>{q.question}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                You: {q.options.find((o) => o.id === result.myAnswers?.[q.id])?.text}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                Them: {q.options.find((o) => o.id === result.theirAnswers?.[q.id])?.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
