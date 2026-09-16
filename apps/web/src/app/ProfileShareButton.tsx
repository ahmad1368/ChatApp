"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ProfileShareOpinion {
  commenterName: string;
  reaction: "like" | "pass";
  comment: string;
}

/**
 * Tinder's real "Ability to share a profile with a friend for their
 * opinion" (#264) — generates a no-account-needed share link (see
 * profileShare.ts), same copy-a-link UX as #46/#47's safety-share
 * features. Re-clicking after already sharing this candidate re-fetches
 * the same link's accumulated friend opinions instead of minting a new one.
 */
export default function ProfileShareButton({ sharer, candidateAuthor }: { sharer: string; candidateAuthor: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [opinions, setOpinions] = useState<ProfileShareOpinion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const share = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/profile-shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharer, candidateAuthor }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to create share link");
      }
      setShareUrl(`${window.location.origin}/shared-profile/${body.share.shareCode}`);
      setOpinions(body.share.opinions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share link");
    }
  };

  return (
    <div style={{ marginTop: 8, fontSize: 12 }}>
      <button onClick={share}>🙋 Ask a friend</button>
      {shareUrl && (
        <div style={{ marginTop: 4 }}>
          <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} style={{ width: "100%", fontSize: 11 }} />
          {opinions.length > 0 && (
            <ul style={{ textAlign: "left", marginTop: 4 }}>
              {opinions.map((o, i) => (
                <li key={i}>
                  {o.commenterName}: {o.reaction === "like" ? "👍" : "👎"} {o.comment}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
