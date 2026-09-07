"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const SECTION_LABELS: Record<string, string> = {
  photo: "Add a photo",
  bio: "Write a bio",
  job: "Add your job",
  education: "Add your education",
  height: "Add your height",
  lifestyle: "Add smoking/drinking status",
  familyPlans: "Add family plans",
  zodiac: "Add your zodiac sign",
  languages: "Add languages you speak",
  beliefs: "Add religion/political views",
  pets: "Add pet status",
  personality: "Add your personality type",
  interests: "Add interests",
  prompts: "Answer a profile prompt",
};

interface Completion {
  percentage: number;
  completedSections: string[];
  missingSections: string[];
}

export default function ProfileCompletion({ author }: { author: string }) {
  const [completion, setCompletion] = useState<Completion | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/profile-completion/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setCompletion(body.completion ?? null))
      .catch(() => {});
  }, [author]);

  if (!completion) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Profile completion</h2>
      <div style={{ background: "var(--color-border)", borderRadius: 4, height: 8, marginTop: 4 }}>
        <div
          style={{
            width: `${completion.percentage}%`,
            background: "var(--color-accent, #4a5568)",
            height: "100%",
            borderRadius: 4,
          }}
        />
      </div>
      <p style={{ color: "var(--color-muted)", marginTop: 4 }}>{completion.percentage}% complete</p>
      {completion.missingSections.length > 0 && (
        <ul>
          {completion.missingSections.map((section) => (
            <li key={section}>{SECTION_LABELS[section] ?? section}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
