"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Visitor {
  author: string;
  visitedAt: string;
}

/**
 * Tinder Gold's real "Who's Viewed You" (#104): everyone who viewed this
 * author's profile (via /profile/[author]) in the last 24 hours — see
 * profileVisits.ts for the window/pruning rules. Free here since this
 * app has no premium tier, same scoping call as #103's free Likes You.
 */
export default function VisitorsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [visitors, setVisitors] = useState<Visitor[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/profile-visitors/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setVisitors(body.visitors ?? []))
      .catch(() => {});
  }, [author]);

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Profile visitors</h1>
      <p style={{ color: "var(--color-muted)" }}>Who viewed your profile in the last 24 hours.</p>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>
      {visitors.length === 0 ? (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No visitors yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {visitors.map((visitor) => (
            <li
              key={visitor.author}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <Link href={`/profile/${encodeURIComponent(visitor.author)}`} style={{ fontWeight: "bold" }}>
                {visitor.author}
              </Link>
              <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
                {new Date(visitor.visitedAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
