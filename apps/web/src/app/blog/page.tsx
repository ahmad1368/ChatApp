"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CATEGORY_LABEL: Record<string, string> = {
  communication: "Communication",
  "attachment-styles": "Attachment Styles",
  "conflict-resolution": "Conflict Resolution",
  "dating-tips": "Dating Tips",
  "red-flags": "Red Flags",
  "long-term-commitment": "Long-Term Commitment",
};

interface ArticleSummary {
  id: string;
  title: string;
  category: string;
  summary: string;
  author: string;
  publishedAt: string;
  readCount: number;
}

interface Article extends ArticleSummary {
  body: string;
}

/**
 * eHarmony's real "Educational blog section with relationship psychology
 * articles" (#226) — see relationshipBlog.ts for the honest scoping (a
 * seeded catalog of real articles, extendable via an admin-gated publish
 * endpoint).
 */
export default function BlogPage() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Article | null>(null);

  const loadArticles = (cat: string) => {
    const url = cat ? `${API_URL}/api/blog/articles?category=${encodeURIComponent(cat)}` : `${API_URL}/api/blog/articles`;
    fetch(url)
      .then((res) => res.json())
      .then((body) => setArticles(body.articles ?? []))
      .catch(() => {});
  };

  useEffect(() => loadArticles(category), [category]);

  const openArticle = (id: string) => {
    fetch(`${API_URL}/api/blog/articles/${id}`)
      .then((res) => res.json())
      .then((body) => setSelected(body.article ?? null))
      .catch(() => {});
  };

  return (
    <main style={{ maxWidth: 560, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Relationship Psychology</h1>

      {!selected && (
        <>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%", marginBottom: 16 }}>
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {articles.map((article) => (
              <button
                key={article.id}
                onClick={() => openArticle(article.id)}
                style={{ textAlign: "left", border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, cursor: "pointer" }}
              >
                <p style={{ fontWeight: 700, margin: 0 }}>{article.title}</p>
                <p style={{ margin: "4px 0", fontSize: 13 }}>{article.summary}</p>
                <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0 }}>
                  {CATEGORY_LABEL[article.category] ?? article.category} &middot; {new Date(article.publishedAt).toLocaleDateString()}
                </p>
              </button>
            ))}
            {articles.length === 0 && <p style={{ color: "var(--color-muted)" }}>No articles in this category yet.</p>}
          </div>
        </>
      )}

      {selected && (
        <>
          <button onClick={() => setSelected(null)} style={{ marginBottom: 12 }}>
            &larr; All articles
          </button>
          <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0 }}>{CATEGORY_LABEL[selected.category] ?? selected.category}</p>
          <h2 style={{ marginTop: 4 }}>{selected.title}</h2>
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>
            By {selected.author} &middot; {new Date(selected.publishedAt).toLocaleDateString()}
          </p>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{selected.body}</p>
        </>
      )}
    </main>
  );
}
