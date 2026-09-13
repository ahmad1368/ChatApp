"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Ability to remove ads for pro users" (#201) — a real ad
 * network (AdMob, Meta Audience Network, etc.) needs a publisher account
 * this environment has no credentials for, same disclosed gap as
 * Google/Apple Sign-In's own credential requirement elsewhere in this
 * app, so this renders an honestly-labeled placeholder slot rather than
 * pretending to serve a real ad. What's real: whether the slot renders
 * at all — see server.ts's GET /api/ads/:author/should-show, which any
 * active #191 subscription tier turns off.
 */
export default function AdBanner({ author }: { author: string }) {
  const [showAds, setShowAds] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/ads/${encodeURIComponent(author)}/should-show`)
      .then((res) => res.json())
      .then((body) => setShowAds(body.showAds ?? false))
      .catch(() => {});
  }, [author]);

  if (!showAds) return null;

  return (
    <div
      style={{
        border: "1px dashed var(--color-border)",
        borderRadius: 8,
        padding: 12,
        margin: "12px 0",
        textAlign: "center",
        color: "var(--color-muted)",
        fontSize: 12,
      }}
    >
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Advertisement</div>
      Go ad-free with a subscription
    </div>
  );
}
