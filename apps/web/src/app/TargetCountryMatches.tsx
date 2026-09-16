"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const COUNTRY_LABELS: Record<string, string> = {
  canada: "Canada",
  unitedStates: "United States",
  unitedKingdom: "United Kingdom",
  australia: "Australia",
  newZealand: "New Zealand",
  germany: "Germany",
  netherlands: "Netherlands",
  ireland: "Ireland",
  sweden: "Sweden",
  switzerland: "Switzerland",
  singapore: "Singapore",
  japan: "Japan",
  southKorea: "South Korea",
  unitedArabEmirates: "United Arab Emirates",
  spain: "Spain",
  portugal: "Portugal",
  italy: "Italy",
  france: "France",
  mexico: "Mexico",
  brazil: "Brazil",
};

interface TargetCountryMatchEntry {
  author: string;
  targetCountry: string;
}

/**
 * Match.com's real "find a travel companion" for a shared immigration
 * goal (#325), same shape as WeekendPlanMatches.tsx — see
 * targetImmigrationCountryMatch.ts.
 */
export default function TargetCountryMatches({ author }: { author: string }) {
  const [matches, setMatches] = useState<TargetCountryMatchEntry[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/target-country-matches/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setMatches(body.candidates ?? []))
      .catch(() => {});
  }, [author]);

  if (matches.length === 0) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14 }}>✈️ Same target country</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {matches.map((entry) => (
          <div
            key={entry.author}
            style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, maxWidth: 320 }}
          >
            <strong>{entry.author}</strong>
            <div style={{ color: "var(--color-muted)", fontSize: 12 }}>
              You&apos;re both planning to move to {COUNTRY_LABELS[entry.targetCountry] ?? entry.targetCountry}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
