"use client";

import { useEffect, useState } from "react";
import { DATE_STATUS_LABELS, SharedDateView as SharedDateViewType } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const POLL_INTERVAL_MS = 10000;

export default function SharedDateView({ shareCode }: { shareCode: string }) {
  const [view, setView] = useState<SharedDateViewType | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = () => {
      fetch(`${API_URL}/api/shared-dates/shared/${shareCode}`)
        .then((res) => {
          if (!res.ok) throw new Error("not found");
          return res.json();
        })
        .then((body) => {
          setView(body);
          setNotFound(false);
        })
        .catch(() => setNotFound(true));
    };
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [shareCode]);

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Date shared with you</h1>
      {notFound && <p>This link is invalid or sharing has stopped.</p>}
      {!notFound && !view && <p>Loading…</p>}
      {view && (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
          <p>
            <strong>{view.author}</strong> is meeting <strong>{view.meetingWith}</strong>.
          </p>
          <p>
            <strong>Location:</strong> {view.location}
          </p>
          <p>
            <strong>When:</strong> {new Date(view.scheduledAt).toLocaleString()}
          </p>
          <p>
            <strong>Status:</strong> {DATE_STATUS_LABELS[view.status]}
          </p>
          <p style={{ fontSize: 12, color: "#888" }}>This page refreshes automatically.</p>
        </div>
      )}
    </main>
  );
}
