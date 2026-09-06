"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, verifyOtp } from "../authClient";

type Step = "phone" | "otp";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestOtp(phoneNumber);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyOtp(phoneNumber, code);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ maxWidth: 360, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Sign up</h1>
      {/* Simple two-step progress indicator, matching the resumable-onboarding pattern. */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        <div style={{ height: 4, flex: 1, borderRadius: 2, background: "#2563eb" }} />
        <div style={{ height: 4, flex: 1, borderRadius: 2, background: step === "otp" ? "#2563eb" : "#e5e7eb" }} />
      </div>

      {step === "phone" && (
        <form onSubmit={handleRequestOtp}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Phone number</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+15551234567"
            required
            style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
          />
          {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={isSubmitting} style={{ width: "100%", padding: 10 }}>
            {isSubmitting ? "Sending…" : "Send verification code"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerifyOtp}>
          <p style={{ fontSize: 13, color: "#6b7280" }}>
            Enter the 6-digit code sent to <strong>{phoneNumber}</strong>.
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
          <button type="submit" disabled={isSubmitting} style={{ width: "100%", padding: 10, marginBottom: 8 }}>
            {isSubmitting ? "Verifying…" : "Verify and continue"}
          </button>
          <button type="button" onClick={() => setStep("phone")} style={{ width: "100%", padding: 6, background: "none", border: "none", color: "#2563eb", cursor: "pointer" }}>
            Use a different number
          </button>
        </form>
      )}
    </main>
  );
}
