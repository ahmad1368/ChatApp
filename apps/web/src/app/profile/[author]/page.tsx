"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";

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

/**
 * Viewing someone else's profile (as opposed to ProfilePreview.tsx's
 * self-preview on /settings/profile) — the surface Tinder Gold's real
 * "Who's Viewed You" (#104) tracks visits from. Loading this page sends
 * ?viewer=<me>, which server.ts's profile-preview route records as a
 * visit unless viewing your own profile.
 */
export default function ViewProfilePage({ params }: { params: { author: string } }) {
  const [viewer] = useState(() => getOrCreateGuestIdentity());
  const [preview, setPreview] = useState<ProfilePreviewData | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/profile-preview/${encodeURIComponent(params.author)}?viewer=${encodeURIComponent(viewer)}`)
      .then((res) => res.json())
      .then((body) => setPreview(body.preview ?? {}))
      .catch(() => {});
  }, [params.author, viewer]);

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>
      <h1>{params.author}</h1>
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
    </main>
  );
}
