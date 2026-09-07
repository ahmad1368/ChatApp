"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ProfilePreviewData {
  bio?: string;
  jobTitle?: string;
  company?: string;
  school?: string;
  heightCm?: number;
  smoking?: string;
  drinking?: string;
  familyPlans?: string;
  zodiacSign?: string;
  languages?: string[];
  religion?: string;
  politicalView?: string;
  pets?: string[];
  mbtiType?: string;
  enneagramType?: number;
  spotifyTopTracks?: string[];
  instagramPosts?: string[];
  interests?: string[];
}

const FIELD_LABELS: Record<keyof ProfilePreviewData, string> = {
  bio: "Bio",
  jobTitle: "Job title",
  company: "Company",
  school: "School",
  heightCm: "Height (cm)",
  smoking: "Smoking",
  drinking: "Drinking",
  familyPlans: "Family plans",
  zodiacSign: "Zodiac sign",
  languages: "Languages",
  religion: "Religion",
  politicalView: "Political views",
  pets: "Pets",
  mbtiType: "MBTI",
  enneagramType: "Enneagram",
  spotifyTopTracks: "Spotify top tracks",
  instagramPosts: "Instagram posts",
  interests: "Interests",
};

export default function ProfilePreview({ author }: { author: string }) {
  const [preview, setPreview] = useState<ProfilePreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/profile-preview/${encodeURIComponent(author)}`);
      const body = await res.json();
      setPreview(body.preview ?? {});
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Preview my profile</h2>
      <p style={{ color: "var(--color-muted)" }}>See exactly what other people see — hidden fields won&apos;t appear.</p>
      <button onClick={load} disabled={loading}>
        {preview ? "Refresh preview" : "Show preview"}
      </button>
      {preview && (
        <dl style={{ marginTop: 8 }}>
          {(Object.entries(preview) as [keyof ProfilePreviewData, unknown][]).map(([key, value]) => (
            <div key={key} style={{ marginTop: 4 }}>
              <dt style={{ fontWeight: "bold", display: "inline" }}>{FIELD_LABELS[key]}: </dt>
              <dd style={{ display: "inline" }}>{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
            </div>
          ))}
          {Object.keys(preview).length === 0 && <p style={{ color: "var(--color-muted)" }}>Nothing shared yet.</p>}
        </dl>
      )}
    </section>
  );
}
