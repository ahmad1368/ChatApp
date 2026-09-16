"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REPORT_INTERVAL_MS = 30_000;

/**
 * Bumble's real "Ability to limit daily app usage time" (#289) — reports
 * real elapsed active seconds (only while the tab is visible, so a
 * backgrounded/minimized tab doesn't count) on a fixed interval to
 * usageTime.ts, and shows a dismissible reminder once the viewer's own
 * chosen daily limit is reached. Dismissing only hides today's reminder —
 * it doesn't stop usage from still being tracked or reset the limit.
 */
export default function UsageTimeTracker({ author }: { author: string }) {
  const [limitReached, setLimitReached] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pendingSecondsRef = useRef(0);

  useEffect(() => {
    let lastTick = Date.now();
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        pendingSecondsRef.current += (now - lastTick) / 1000;
      }
      lastTick = now;
    };
    const intervalId = setInterval(tick, 1000);

    const report = () => {
      const seconds = Math.round(pendingSecondsRef.current);
      pendingSecondsRef.current = 0;
      if (seconds <= 0) return;
      fetch(`${API_URL}/api/usage-time/${encodeURIComponent(author)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds }),
      })
        .then((res) => res.json())
        .then((body) => setLimitReached(Boolean(body.limitReached)))
        .catch(() => {});
    };
    const reportIntervalId = setInterval(report, REPORT_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      clearInterval(reportIntervalId);
      report();
    };
  }, [author]);

  if (!limitReached || dismissed) return null;

  return (
    <div style={{ background: "#fef3c7", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span>
        ⏱️ You've reached your daily usage limit. <Link href="/settings/usage-limit">Change it</Link>
      </span>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
