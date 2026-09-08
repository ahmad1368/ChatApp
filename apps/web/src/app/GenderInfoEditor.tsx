"use client";

import { useEffect, useState } from "react";
import { GENDER_OPTIONS, GENDER_OPTION_LABELS, GenderOption } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Bumble's real "women message first" rule (#135) needs a declared
 * gender to enforce at all — this is that declaration, kept separate
 * from #21-28's auth-gated onboarding gender step since this app's
 * discovery/matching layer runs on guest chat identities (genderInfo.ts).
 */
export default function GenderInfoEditor({ author }: { author: string }) {
  const [gender, setGender] = useState<GenderOption | "">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/gender-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setGender(body.gender ?? ""))
      .catch(() => {});
  }, [author]);

  const choose = async (next: GenderOption) => {
    setGender(next);
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/gender-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gender: next }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Gender</h2>
      <p style={{ color: "var(--color-muted)" }}>
        Used to enforce Bumble-style "women message first" in a woman/man match.
      </p>
      <select value={gender} onChange={(e) => choose(e.target.value as GenderOption)} disabled={busy}>
        <option value="" disabled>
          Select your gender
        </option>
        {GENDER_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {GENDER_OPTION_LABELS[option]}
          </option>
        ))}
      </select>
    </section>
  );
}
