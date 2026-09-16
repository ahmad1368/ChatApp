"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface CertificateStatus {
  status: "pending" | "approved" | "rejected";
  examType: string;
  score: string;
}

const STATUS_LABEL: Record<CertificateStatus["status"], string> = {
  pending: "Under review",
  approved: "✅ Verified",
  rejected: "Not approved — you can resubmit",
};

/**
 * Raya's real "Ability to upload official language certificates
 * (IELTS/TOEFL)" (#324) — see languageCertificate.ts for why a
 * submission starts pending rather than auto-verified (this environment
 * has no real IELTS/ETS verification-service integration).
 */
export default function LanguageCertificateSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [examType, setExamType] = useState("");
  const [score, setScore] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [certificate, setCertificate] = useState<CertificateStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/language-certificate/exam-types`)
      .then((res) => res.json())
      .then((body) => {
        setExamTypes(body.examTypes ?? []);
        setExamType(body.examTypes?.[0] ?? "");
      })
      .catch(() => {});
    fetch(`${API_URL}/api/language-certificate/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setCertificate(body.certificate ?? null))
      .catch(() => {});
  }, [author]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] ?? "";

      const res = await fetch(`${API_URL}/api/language-certificate/${encodeURIComponent(author)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examType, score, mimeType: file.type, data: base64 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to submit certificate");
      setCertificate({ status: "pending", examType, score });
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit certificate");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Language certificate (IELTS/TOEFL)</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Upload a photo or PDF of your official IELTS or TOEFL certificate. An admin reviews every submission before
        it shows as verified — this isn&apos;t an automatic check.
      </p>

      {certificate && (
        <p style={{ marginTop: 16 }}>
          <strong>{certificate.examType}</strong> — score {certificate.score}: {STATUS_LABEL[certificate.status]}
        </p>
      )}

      {(!certificate || certificate.status === "rejected") && (
        <form onSubmit={submit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <select value={examType} onChange={(e) => setExamType(e.target.value)}>
            {examTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input type="text" required value={score} onChange={(e) => setScore(e.target.value)} placeholder="Score (e.g. 7.5)" />
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="submit" disabled={busy || !file}>
            Submit for review
          </button>
        </form>
      )}

      {error && <p style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </main>
  );
}
