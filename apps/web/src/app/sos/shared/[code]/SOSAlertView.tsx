"use client";

import { useEffect, useState } from "react";
import { SOSAlertView as SOSAlertViewType } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const POLL_INTERVAL_MS = 5000;

export default function SOSAlertView({ shareCode }: { shareCode: string }) {
  const [view, setView] = useState<SOSAlertViewType | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = () => {
      fetch(`${API_URL}/api/sos/alerts/shared/${shareCode}`)
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
      <h1>🆘 Emergency alert</h1>
      {notFound && <p>This link is invalid.</p>}
      {!notFound && !view && <p>Loading…</p>}
      {view && (
        <div
          style={{
            border: `2px solid ${view.resolved ? "#2e7d32" : "#b00020"}`,
            borderRadius: 8,
            padding: 12,
          }}
        >
          <p style={{ fontWeight: "bold", color: view.resolved ? "#2e7d32" : "#b00020" }}>
            {view.resolved ? "Resolved — they're safe." : "Active emergency"}
          </p>
          <p>
            <strong>{view.author}</strong> triggered this alert at {new Date(view.triggeredAt).toLocaleString()}.
          </p>
          <p>
            <strong>Last known location:</strong>{" "}
            <a
              href={`https://www.google.com/maps?q=${view.location.latitude},${view.location.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              {view.location.latitude.toFixed(5)}, {view.location.longitude.toFixed(5)}
            </a>
          </p>
          <p style={{ fontSize: 12, color: "#888" }}>
            Last updated {new Date(view.updatedAt).toLocaleTimeString()}. This page refreshes automatically.
          </p>
        </div>
      )}
    </main>
  );
}
