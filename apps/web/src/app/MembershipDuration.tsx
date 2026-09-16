"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatDuration(joinedAt: string): string {
  const days = Math.floor((Date.now() - new Date(joinedAt).getTime()) / (24 * 60 * 60 * 1000));
  if (days < 1) return "Joined today";
  if (days < 30) return `Member for ${days} day${days === 1 ? "" : "s"}`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `Member for ${months} month${months === 1 ? "" : "s"}`;
  }
  const years = Math.floor(days / 365);
  return `Member for ${years} year${years === 1 ? "" : "s"}`;
}

/**
 * Tinder's real "Show the user's membership duration on the platform"
 * (#300) — see membership.ts for the real first-seen stamp this reads.
 * Renders nothing until that stamp exists (e.g. a profile from before
 * this feature shipped, or one that's never actually visited the app).
 */
export default function MembershipDuration({ author }: { author: string }) {
  const [joinedAt, setJoinedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/membership/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setJoinedAt(body.joinedAt ?? null))
      .catch(() => {});
  }, [author]);

  if (!joinedAt) return null;

  return <p style={{ color: "var(--color-muted)", fontSize: 12, margin: "4px 0" }}>{formatDuration(joinedAt)}</p>;
}
