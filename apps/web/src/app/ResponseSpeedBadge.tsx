"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ResponseSpeedLabel = "fast" | "moderate" | "slow" | "unknown";

interface ResponseSpeed {
  medianResponseSeconds: number | null;
  label: ResponseSpeedLabel;
}

/**
 * Tinder's real "System showing a user's message response speed" (#254)
 * — a positive-only badge, same "highlight a good trait, don't shame a
 * bad one" norm real dating apps use for this: "slow" and "unknown"
 * render nothing rather than calling someone out as a slow replier.
 */
export default function ResponseSpeedBadge({ author }: { author: string }) {
  const [speed, setSpeed] = useState<ResponseSpeed | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/response-speed/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setSpeed(body ?? null))
      .catch(() => {});
  }, [author]);

  if (!speed || speed.label === "slow" || speed.label === "unknown") return null;

  const text = speed.label === "fast" ? "⚡ Usually replies within minutes" : "💬 Usually replies within the hour";

  return (
    <p style={{ color: "var(--color-muted)", fontSize: 12, margin: "4px 0" }}>{text}</p>
  );
}
