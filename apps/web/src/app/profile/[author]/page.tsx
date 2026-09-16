"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";
import ProfilePhotoGallery from "../../ProfilePhotoGallery";
import BackgroundMusicPlayer from "../../BackgroundMusicPlayer";
import ResponseSpeedBadge from "../../ResponseSpeedBadge";
import { formatHeightCm, MeasurementSystem } from "../../measurementUnits";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ProfilePreviewData {
  bio?: string;
  weeklyGoal?: string;
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

interface PresenceStatus {
  online: boolean;
  lastActiveAt: string | null;
}

function formatLastActive(lastActiveAt: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(lastActiveAt).getTime()) / 60_000));
  if (minutes < 1) return "Active just now";
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  return `Active ${Math.round(hours / 24)}d ago`;
}

const FIELD_LABELS: Record<keyof ProfilePreviewData, string> = {
  bio: "Bio",
  weeklyGoal: "Goal this week",
  jobTitle: "Job title",
  company: "Company",
  school: "School",
  heightCm: "Height",
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
 * visit unless viewing your own profile. The "Send a direct message"
 * form is #208's real "Pay to open a direct chat without needing a
 * Match" — see directMessageRequests.ts for the honest scoping (a real
 * coin-priced request landing in their own inbox, not an open chat).
 */
export default function ViewProfilePage({ params }: { params: { author: string } }) {
  const [viewer] = useState(() => getOrCreateGuestIdentity());
  const [preview, setPreview] = useState<ProfilePreviewData | null>(null);
  const [presence, setPresence] = useState<PresenceStatus | null>(null);
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>("metric");
  const [directMessageText, setDirectMessageText] = useState("");
  const [directMessageResult, setDirectMessageResult] = useState<string | null>(null);

  const sendDirectMessageRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectMessageResult(null);
    const res = await fetch(`${API_URL}/api/direct-message-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: viewer, to: params.author, text: directMessageText }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDirectMessageResult(body.error ?? "Failed to send");
      return;
    }
    setDirectMessageText("");
    setDirectMessageResult("Sent! They'll see it in their message requests.");
  };

  useEffect(() => {
    fetch(`${API_URL}/api/profile-preview/${encodeURIComponent(params.author)}?viewer=${encodeURIComponent(viewer)}`)
      .then((res) => res.json())
      .then((body) => setPreview(body.preview ?? {}))
      .catch(() => {});
  }, [params.author, viewer]);

  // #163's "Set measurement units" — the viewer's own preference, so
  // heightCm below is formatted the way *they* chose to see it, not the
  // profile owner's.
  useEffect(() => {
    fetch(`${API_URL}/api/measurement-units/${encodeURIComponent(viewer)}`)
      .then((res) => res.json())
      .then((body) => body?.system && setMeasurementSystem(body.system))
      .catch(() => {});
  }, [viewer]);

  // Badoo's real online/last-active indicator (#110): a plain snapshot
  // fetch is enough here since this page doesn't already hold a socket
  // connection the way ChatRoom.tsx does; polled rather than pushed live,
  // matching the coarse "how recently was this person around" framing.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${API_URL}/api/presence/${encodeURIComponent(params.author)}?viewer=${encodeURIComponent(viewer)}`)
        .then((res) => res.json())
        .then((body) => {
          if (!cancelled) setPresence(body);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [params.author, viewer]);

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>
      <h1>{params.author}</h1>
      {presence && (
        <p style={{ color: presence.online ? "#2e7d32" : "var(--color-muted)", margin: "0 0 12px" }}>
          {presence.online
            ? "🟢 Online now"
            : presence.lastActiveAt
              ? formatLastActive(presence.lastActiveAt)
              : "Activity unknown"}
        </p>
      )}
      <ResponseSpeedBadge author={params.author} />
      {preview && (
        <dl style={{ marginTop: 8 }}>
          {(Object.entries(preview) as [keyof ProfilePreviewData, unknown][]).map(([key, value]) => (
            <div key={key} style={{ marginTop: 4 }}>
              <dt style={{ fontWeight: "bold", display: "inline" }}>{FIELD_LABELS[key]}: </dt>
              <dd style={{ display: "inline" }}>
                {key === "heightCm" && typeof value === "number"
                  ? formatHeightCm(value, measurementSystem)
                  : Array.isArray(value)
                    ? value.join(", ")
                    : String(value)}
              </dd>
            </div>
          ))}
          {Object.keys(preview).length === 0 && <p style={{ color: "var(--color-muted)" }}>Nothing shared yet.</p>}
        </dl>
      )}
      <ProfilePhotoGallery owner={params.author} viewer={viewer} />
      <BackgroundMusicPlayer author={params.author} />

      <form onSubmit={sendDirectMessageRequest} style={{ marginTop: 16, border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Send a direct message (100 coins)</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 0 }}>
          No match needed — it lands in their message requests.
        </p>
        <textarea
          value={directMessageText}
          onChange={(e) => setDirectMessageText(e.target.value)}
          placeholder="Say hi..."
          rows={2}
          style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
        />
        <button type="submit" disabled={!directMessageText.trim()} style={{ marginTop: 8 }}>
          Send
        </button>
        {directMessageResult && <p style={{ fontSize: 13, marginTop: 8 }}>{directMessageResult}</p>}
      </form>
    </main>
  );
}
