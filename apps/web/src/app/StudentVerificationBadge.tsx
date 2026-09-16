"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Raya's real "Student verification system via university (.edu) email"
 * (#305) — see studentVerification.ts for the real .edu-suffix + one-time
 * code verification this reads. Renders nothing unless the profile's
 * author has actually confirmed a university email, same
 * badge-only-on-success pattern as #254's ResponseSpeedBadge.
 */
export default function StudentVerificationBadge({ author }: { author: string }) {
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/student-verification/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setVerified(body.verified ?? false))
      .catch(() => {});
  }, [author]);

  if (!verified) return null;

  return <p style={{ color: "var(--color-muted)", fontSize: 12, margin: "4px 0" }}>🎓 Verified student</p>;
}
