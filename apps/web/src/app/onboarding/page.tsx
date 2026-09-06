"use client";

import { useEffect, useState } from "react";
import { DATING_GOALS, DATING_GOAL_LABELS, DatingGoal, ONBOARDING_STEPS, OnboardingState } from "@chatapp/shared";
import { loadStoredAuth } from "../authClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TEXT_STEP_LABELS: Partial<Record<(typeof ONBOARDING_STEPS)[number], { title: string; placeholder: string; optional?: boolean }>> = {
  displayName: { title: "What should we call you?", placeholder: "Your display name" },
  avatar: { title: "Add a profile photo", placeholder: "Paste an image URL", optional: true },
  bio: { title: "Say a little about yourself", placeholder: "A short bio", optional: true },
};

export default function OnboardingPage() {
  const auth = loadStoredAuth();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    fetch(`${API_URL}/api/onboarding`, { headers: { Authorization: `Bearer ${auth.tokens.accessToken}` } })
      .then((res) => res.json())
      .then(setState);
  }, [auth?.tokens.accessToken]);

  if (!auth) {
    return (
      <main style={{ maxWidth: 360, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
        <p style={{ color: "#6b7280" }}>Sign in to set up your profile.</p>
      </main>
    );
  }

  const submitStep = async (step: string, stepValue: unknown) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/onboarding/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.tokens.accessToken}` },
      body: JSON.stringify({ step, data: stepValue }),
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
        <p style={{ color: "#6b7280" }}>
          Welcome, {state.profile.displayName}. Looking for{" "}
          {state.profile.datingGoal && DATING_GOAL_LABELS[state.profile.datingGoal].toLowerCase()}.
        </p>
      </main>
    );
  }

  const stepIndex = ONBOARDING_STEPS.indexOf(state.currentStep);

  return (
    <main style={{ maxWidth: 360, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Set up your profile</h1>
      <div style={{ display: "flex", gap: 6, margin: "16px 0" }}>
        {ONBOARDING_STEPS.map((step, i) => (
          <div key={step} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= stepIndex ? "#2563eb" : "#e5e7eb" }} />
        ))}
      </div>

      {state.currentStep === "datingGoal" ? (
        <div>
          <label style={{ display: "block", fontSize: 14, marginBottom: 12 }}>What are you here for?</label>
          {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DATING_GOALS.map((goal: DatingGoal) => (
              <button
                key={goal}
                onClick={() => submitStep("datingGoal", goal)}
                style={{
                  padding: 16,
                  fontSize: 15,
                  textAlign: "left",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                {DATING_GOAL_LABELS[goal]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        (() => {
          const config = TEXT_STEP_LABELS[state.currentStep]!;
          return (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitStep(state.currentStep, value);
              }}
            >
              <label style={{ display: "block", fontSize: 14, marginBottom: 8 }}>{config.title}</label>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={config.placeholder}
                required={!config.optional}
                style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
              />
              {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                {config.optional && (
                  <button type="button" onClick={() => submitStep(state.currentStep, "")} style={{ flex: 1, padding: 10 }}>
                    Skip
                  </button>
                )}
                <button type="submit" style={{ flex: 1, padding: 10 }}>
                  Continue
                </button>
              </div>
            </form>
          );
        })()
      )}
    </main>
  );
}
