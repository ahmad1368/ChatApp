"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AchievementBadge {
  id: string;
  name: string;
  description: string;
}

interface EarnedBadge extends AchievementBadge {
  earnedAt: string;
}

/**
 * Hinge's real "Achievement badges and medals" (#213) — see
 * achievementBadges.ts for the honest scoping (a fixed, app-earned badge
 * catalog awarded automatically at real milestones elsewhere in the
 * app — a match, a #212 week-long login streak, a #86 100%-complete
 * profile — never something a user can claim from this page).
 */
export default function AchievementsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [badges, setBadges] = useState<AchievementBadge[]>([]);
  const [earned, setEarned] = useState<EarnedBadge[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/achievement-badges`)
      .then((res) => res.json())
      .then((body) => setBadges(body.badges ?? []))
      .catch(() => {});
    fetch(`${API_URL}/api/achievement-badges/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setEarned(body.earned ?? []))
      .catch(() => {});
  }, [author]);

  const earnedIds = new Set(earned.map((b) => b.id));

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Achievements</h1>
      <p style={{ color: "var(--color-muted)" }}>
        {earned.length} of {badges.length} badges earned
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {badges.map((badge) => {
          const isEarned = earnedIds.has(badge.id);
          return (
            <div
              key={badge.id}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 12,
                opacity: isEarned ? 1 : 0.5,
              }}
            >
              <p style={{ fontWeight: 700, margin: 0 }}>
                {isEarned ? "🏅" : "🔒"} {badge.name}
              </p>
              <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "4px 0 0" }}>{badge.description}</p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
