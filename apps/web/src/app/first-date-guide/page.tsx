"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface DateAdviceTopic {
  id: string;
  title: string;
  advice: string;
}

/**
 * Hinge's real "Guide chatbot for advice before the first date" (#234)
 * — see firstDateGuide.ts for the honest scoping (a keyword-matching
 * decision-tree guide over a curated real topic catalog).
 */
export default function FirstDateGuidePage() {
  const [topics, setTopics] = useState<DateAdviceTopic[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<DateAdviceTopic | null>(null);
  const [askedNoMatch, setAskedNoMatch] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/first-date-guide/topics`)
      .then((res) => res.json())
      .then((body) => setTopics(body.topics ?? []))
      .catch(() => {});
  }, []);

  const ask = async () => {
    setAskedNoMatch(false);
    setAnswer(null);
    const res = await fetch(`${API_URL}/api/first-date-guide/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const body = await res.json();
    if (body.topic) {
      setAnswer(body.topic);
    } else {
      setAskedNoMatch(true);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>First Date Guide</h1>
      <p style={{ color: "var(--color-muted)" }}>Ask a question, or browse common topics below.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What should I wear?" style={{ flex: 1 }} />
        <button onClick={ask} disabled={!question.trim()}>
          Ask
        </button>
      </div>

      {answer && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <p style={{ fontWeight: 700, margin: 0 }}>{answer.title}</p>
          <p style={{ margin: "4px 0 0" }}>{answer.advice}</p>
        </div>
      )}
      {askedNoMatch && (
        <p style={{ color: "var(--color-muted)", marginBottom: 16 }}>
          I don&apos;t have specific advice for that yet — here are the topics I can help with:
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => setAnswer(topic)}
            style={{ textAlign: "left", border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, cursor: "pointer" }}
          >
            {topic.title}
          </button>
        ))}
      </div>
    </main>
  );
}
