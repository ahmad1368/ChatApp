"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface CertificateStatus {
  status: "pending" | "approved" | "rejected";
  examType: string;
  score: string;
}

/**
 * Raya's real "Ability to upload official language certificates
 * (IELTS/TOEFL)" (#324) — see languageCertificate.ts. Renders nothing
 * unless an admin has actually approved the submission, same
 * badge-only-on-success pattern as #305's StudentVerificationBadge.
 */
export default function LanguageCertificateBadge({ author }: { author: string }) {
  const [certificate, setCertificate] = useState<CertificateStatus | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/language-certificate/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setCertificate(body.certificate ?? null))
      .catch(() => {});
  }, [author]);

  if (certificate?.status !== "approved") return null;

  return (
    <p style={{ color: "var(--color-muted)", fontSize: 12, margin: "4px 0" }}>
      🗣️ {certificate.examType} verified — {certificate.score}
    </p>
  );
}
