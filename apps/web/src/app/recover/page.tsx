"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveStoredAuth } from "../authClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Step = "email" | "code";

export default function RecoverAccountPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/recovery/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to send recovery code");
      }
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send recovery code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/recovery/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Invalid or expired code");
      }
      saveStoredAuth(await res.json());
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ maxWidth: 360, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Recover your account</h1>
      <p style={{ fontSize: 13, color: "#6b7280" }}>
        Lost access to your phone number? Verify your recovery email to get back in.
      </p>
      <div style={{ display: "flex", gap: 6, margin: "16px 0" }}>
        <div style={{ height: 4, flex: 1, borderRadius: 2, background: "#2563eb" }} />
        <div style={{ height: 4, flex: 1, borderRadius: 2, background: step === "code" ? "#2563eb" : "#e5e7eb" }} />
      </div>

      {step === "email" && (
        <form onSubmit={handleRequestCode}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
          />
          {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={isSubmitting} style={{ width: "100%", padding: 10 }}>
            {isSubmitting ? "Sending…" : "Send recovery code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleVerifyCode}>
          <p style={{ fontSize: 13, color: "#6b7280" }}>
            Enter the 6-digit code sent to <strong>{email}</strong>.
          </p>
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            required
            style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box", letterSpacing: 4, textAlign: "center" }}
          />
          {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={isSubmitting} style={{ width: "100%", padding: 10 }}>
            {isSubmitting ? "Verifying…" : "Verify and continue"}
          </button>
        </form>
      )}
    </main>
  );
}
