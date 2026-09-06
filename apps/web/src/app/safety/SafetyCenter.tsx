"use client";

import { useState } from "react";
import Link from "next/link";
import { SAFETY_TIPS } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function SafetyCenter() {
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [meetingWith, setMeetingWith] = useState("");
  const [location, setLocation] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sharePlan = async () => {
    setError(null);
    setShareUrl(null);
    const res = await fetch(`${API_URL}/api/safety/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author,
        meetingWith,
        location,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : "",
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Failed to share plan");
      return;
    }
    setShareUrl(`${window.location.origin}/safety/shared/${body.shareCode}`);
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>🛡️ Safety Center</h1>
      <p style={{ color: "#666" }}>
        Meeting someone new is exciting — a little preparation keeps it safe. Here&apos;s how we
        recommend approaching it.
      </p>

      <h2 style={{ fontSize: 16 }}>Safety tips</h2>
      <ul>
        {SAFETY_TIPS.map((tip) => (
          <li key={tip} style={{ marginBottom: 4 }}>
            {tip}
          </li>
        ))}
      </ul>

      <section style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
        <h2 style={{ fontSize: 16 }}>Share your date</h2>
        <p style={{ color: "#666" }}>
          Send a trusted friend the details of your meetup so someone always knows where you are.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          <input
            value={meetingWith}
            onChange={(e) => setMeetingWith(e.target.value)}
            placeholder="Who are you meeting?"
            style={{ padding: 8 }}
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Where are you meeting?"
            style={{ padding: 8 }}
          />
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            style={{ padding: 8 }}
          />
        </div>
        <button onClick={sharePlan}>Create shareable link</button>
        {error && <p style={{ color: "#b00020" }}>{error}</p>}
        {shareUrl && (
          <p>
            Send this link to a trusted contact:{" "}
            <a href={shareUrl} target="_blank" rel="noreferrer">
              {shareUrl}
            </a>
          </p>
        )}
      </section>
    </main>
  );
}
