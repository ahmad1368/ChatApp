"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface WeatherForMatch {
  farAway: boolean;
  distanceKm?: number;
  weather?: { tempCelsius: number; description: string; icon: string } | null;
}

/**
 * Tinder's real "Show the weather in the other person's city if they're
 * far away" (#268) — renders nothing unless the candidate is genuinely
 * far away (see weather.ts's isFarAway) and a real weather API key is
 * configured server-side; no fabricated placeholder weather.
 */
export default function WeatherBadge({ author, candidate }: { author: string; candidate: string }) {
  const [info, setInfo] = useState<WeatherForMatch | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/weather-for-match?author=${encodeURIComponent(author)}&candidate=${encodeURIComponent(candidate)}`)
      .then((res) => res.json())
      .then((body) => setInfo(body))
      .catch(() => {});
  }, [author, candidate]);

  if (!info?.farAway || !info.weather) return null;

  return (
    <p style={{ color: "var(--color-muted)", fontSize: 12 }}>
      🌦️ {info.weather.tempCelsius}°C, {info.weather.description} in their city ({info.distanceKm} km away)
    </p>
  );
}
