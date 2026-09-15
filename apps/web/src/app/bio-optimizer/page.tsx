"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface BioAnalysis {
  score: number;
  wordCount: number;
  hasQuestion: boolean;
  clichesFound: string[];
  keywordCount: number;
  tips: string[];
}

function scoreColor(score: number): string {
  if (score >= 80) return "var(--color-success, green)";
  if (score >= 50) return "var(--color-warning, orange)";
  return "var(--color-danger)";
}

/**
 * Hinge's real "Personal AI assistant for writing an optimized bio"
 * (#231) — see bioOptimizer.ts for the honest scoping (a deterministic
 * rule-based feedback engine, not a fabricated LLM call).
 */
export default function BioOptimizerPage() {
  const [bio, setBio] = useState("");
  const [analysis, setAnalysis] = useState<BioAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/bio-optimizer/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio }),
    });
    if (!res.ok) {
      setError("Failed to analyze bio");
      return;
    }
    const body = await res.json();
    setAnalysis(body.analysis);
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Bio Assistant</h1>
      <p style={{ color: "var(--color-muted)" }}>Get instant, specific feedback on your bio before you save it.</p>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Paste or write your bio here..."
        style={{ width: "100%", minHeight: 120, marginBottom: 8 }}
      />
      <button onClick={analyze} disabled={!bio.trim()}>
        Analyze My Bio
      </button>

      {analysis && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 16 }}>
          <p style={{ margin: 0 }}>
            Score: <strong style={{ color: scoreColor(analysis.score) }}>{analysis.score}/100</strong>
          </p>
          <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 12px" }}>
            {analysis.wordCount} words &middot; {analysis.hasQuestion ? "has a question" : "no question"} &middot; {analysis.keywordCount}{" "}
            specific keywords
          </p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {analysis.tips.map((tip, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
