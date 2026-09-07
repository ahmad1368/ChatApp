"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const PLATFORM_LABELS: Record<string, string> = {
  twitter: "X / Twitter",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  website: "Personal website",
};

type Links = Record<string, string>;

export default function SocialLinksEditor({ author }: { author: string }) {
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [links, setLinks] = useState<Links>({});
  const [hideSocialLinks, setHideSocialLinks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/social-links-info/platforms`).then((res) => res.json()),
      fetch(`${API_URL}/api/social-links-info/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([platformsBody, infoBody]) => {
        setPlatforms(platformsBody.platforms ?? []);
        setLinks(infoBody.socialLinksInfo?.links ?? {});
        setHideSocialLinks(infoBody.socialLinksInfo?.hideSocialLinks ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/social-links-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links, hideSocialLinks }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save social links");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save social links");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Social links</h2>
      {platforms.map((platform) => (
        <input
          key={platform}
          type="url"
          value={links[platform] ?? ""}
          onChange={(e) => setLinks((prev) => ({ ...prev, [platform]: e.target.value }))}
          placeholder={PLATFORM_LABELS[platform] ?? platform}
          style={{ width: "100%", marginTop: 4 }}
        />
      ))}
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideSocialLinks} onChange={(e) => setHideSocialLinks(e.target.checked)} />
        Hide social links on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
