"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ONBOARDING_STEPS, OnboardingState } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STEP_LABELS: Record<(typeof ONBOARDING_STEPS)[number], { title: string; placeholder: string; optional?: boolean }> = {
  displayName: { title: "What should we call you?", placeholder: "Your display name" },
  avatar: { title: "Add a profile photo", placeholder: "Paste an image URL", optional: true },
  bio: { title: "Say a little about yourself", placeholder: "A short bio", optional: true },
};

// Demo entry point: real usage should derive the user id from an
// authenticated session (once #21-#25's auth lands) — see the note in
// apps/api/src/server.ts.
function OnboardingContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") ?? "demo-user";

  const [state, setState] = useState<OnboardingState | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/onboarding/${userId}`)
      .then((res) => res.json())
      .then(setState);
  }, [userId]);

  const submitStep = async (stepValue: string) => {
    if (!state || state.currentStep === "complete") return;
    setError(null);

    const res = await fetch(`${API_URL}/api/onboarding/${userId}/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: state.currentStep, data: stepValue }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    setState(await res.json());
    setValue("");
  };

  if (!state) return null;

  if (state.currentStep === "complete") {
    return (
      <main style={{ maxWidth: 360, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
        <h1>You're all set!</h1>
        <p style={{ color: "#6b7280" }}>Welcome, {state.profile.displayName}.</p>
      </main>
    );
  }

  const stepIndex = ONBOARDING_STEPS.indexOf(state.currentStep);
  const { title, placeholder, optional } = STEP_LABELS[state.currentStep];

  return (
    <main style={{ maxWidth: 360, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Set up your profile</h1>
      <div style={{ display: "flex", gap: 6, margin: "16px 0" }}>
        {ONBOARDING_STEPS.map((step, i) => (
          <div key={step} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= stepIndex ? "#2563eb" : "#e5e7eb" }} />
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitStep(value);
        }}
      >
        <label style={{ display: "block", fontSize: 14, marginBottom: 8 }}>{title}</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          required={!optional}
          style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
        />
        {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          {optional && (
            <button type="button" onClick={() => submitStep("")} style={{ flex: 1, padding: 10 }}>
              Skip
            </button>
          )}
          <button type="submit" style={{ flex: 1, padding: 10 }}>
            Continue
          </button>
        </div>
      </form>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingContent />
    </Suspense>
  );
}
