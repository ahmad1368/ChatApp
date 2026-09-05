"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DATING_GOALS,
  DATING_GOAL_LABELS,
  DatingGoal,
  GENDER_OPTIONS,
  GENDER_OPTION_LABELS,
  GenderOption,
  MAX_PREFERRED_AGE,
  MAX_SEARCH_RADIUS_KM,
  MIN_PREFERRED_AGE,
  MIN_SEARCH_RADIUS_KM,
  ONBOARDING_STEPS,
  ORIENTATION_OPTIONS,
  ORIENTATION_OPTION_LABELS,
  OrientationOption,
  OnboardingState,
} from "@chatapp/shared";
import AvatarCropper from "../AvatarCropper";
import LiveSelfieCapture from "../LiveSelfieCapture";
import VerifiedBadge from "../VerifiedBadge";
import { getOrCreateDraftId } from "../draftId";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TEXT_STEP_LABELS: Partial<Record<(typeof ONBOARDING_STEPS)[number], { title: string; placeholder: string; optional?: boolean }>> = {
  displayName: { title: "What should we call you?", placeholder: "Your display name" },
  bio: { title: "Say a little about yourself", placeholder: "A short bio", optional: true },
};

function AvatarStep({ onSubmit, error }: { onSubmit: (avatarUrl: string) => void; error: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (selected) setFile(selected);
  };

  const handleCropped = async ({ mimeType, base64 }: { mimeType: string; base64: string }) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(`${API_URL}/api/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType, data: base64 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const { url } = await res.json();
      onSubmit(`${API_URL}${url}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  if (file) {
    return (
      <div>
        <label style={{ display: "block", fontSize: 14, marginBottom: 12 }}>Crop your photo</label>
        {(error || uploadError) && <p style={{ color: "#c0392b", fontSize: 13 }}>{error ?? uploadError}</p>}
        <AvatarCropper file={file} onCancel={() => setFile(null)} onCropped={handleCropped} />
        {isUploading && <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center" }}>Uploading…</p>}
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: 14, marginBottom: 12 }}>Add a profile photo</label>
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      <input type="file" accept="image/*" onChange={handleFileChange} style={{ marginBottom: 16 }} />
      <button type="button" onClick={() => onSubmit("")} style={{ width: "100%", padding: 10 }}>
        Skip for now
      </button>
    </div>
  );
}

function GenderStep({ onSubmit, error }: { onSubmit: (data: { option: GenderOption; customText?: string }) => void; error: string | null }) {
  const [selected, setSelected] = useState<GenderOption | null>(null);
  const [customText, setCustomText] = useState("");

  return (
    <div>
      <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>How do you identify?</label>
      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 0, marginBottom: 12 }}>
        This is just for you — you control what's shared later.
      </p>
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {GENDER_OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => setSelected(option)}
            style={{
              padding: "8px 14px",
              fontSize: 14,
              border: selected === option ? "2px solid #2563eb" : "1px solid #e5e7eb",
              borderRadius: 20,
              background: selected === option ? "#eff6ff" : "#fff",
              cursor: "pointer",
            }}
          >
            {GENDER_OPTION_LABELS[option]}
          </button>
        ))}
      </div>
      {selected === "custom" && (
        <input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Describe your gender identity"
          style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
        />
      )}
      <button
        onClick={() => selected && onSubmit({ option: selected, customText: customText || undefined })}
        disabled={!selected}
        style={{ width: "100%", padding: 10 }}
      >
        Continue
      </button>
    </div>
  );
}

function OrientationStep({
  onSubmit,
  error,
}: {
  onSubmit: (data: { option: OrientationOption; customText?: string; interestedIn: GenderOption[] }) => void;
  error: string | null;
}) {
  const [selected, setSelected] = useState<OrientationOption | null>(null);
  const [customText, setCustomText] = useState("");
  const [interestedIn, setInterestedIn] = useState<GenderOption[]>([]);

  const toggleInterest = (option: GenderOption) => {
    setInterestedIn((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  };

  const canSubmit = selected && interestedIn.length > 0;

  return (
    <div>
      <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>What's your orientation?</label>
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {ORIENTATION_OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => setSelected(option)}
            style={{
              padding: "8px 14px",
              fontSize: 14,
              border: selected === option ? "2px solid #2563eb" : "1px solid #e5e7eb",
              borderRadius: 20,
              background: selected === option ? "#eff6ff" : "#fff",
              cursor: "pointer",
            }}
          >
            {ORIENTATION_OPTION_LABELS[option]}
          </button>
        ))}
      </div>
      {selected === "custom" && (
        <input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Describe your orientation"
          style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
        />
      )}

      <label style={{ display: "block", fontSize: 14, margin: "16px 0 4px" }}>Who would you like to meet?</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {GENDER_OPTIONS.filter((o) => o !== "custom" && o !== "preferNotToSay").map((option) => (
          <label
            key={option}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 20,
              fontSize: 13,
            }}
          >
            <input type="checkbox" checked={interestedIn.includes(option)} onChange={() => toggleInterest(option)} />
            {GENDER_OPTION_LABELS[option]}
          </label>
        ))}
      </div>

      <button
        onClick={() => selected && onSubmit({ option: selected, customText: customText || undefined, interestedIn })}
        disabled={!canSubmit}
        style={{ width: "100%", padding: 10 }}
      >
        Continue
      </button>
    </div>
  );
}

function AgeRangeStep({ onSubmit, error }: { onSubmit: (data: { min: number; max: number }) => void; error: string | null }) {
  const [min, setMin] = useState(Math.max(MIN_PREFERRED_AGE, 21));
  const [max, setMax] = useState(Math.min(MAX_PREFERRED_AGE, 40));

  return (
    <div>
      <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>Preferred age range</label>
      <p style={{ fontSize: 18, fontWeight: 600, margin: "8px 0 16px" }}>
        {min} – {max}
      </p>
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}

      <label style={{ display: "block", fontSize: 12, color: "#6b7280" }}>Minimum: {min}</label>
      <input
        type="range"
        min={MIN_PREFERRED_AGE}
        max={MAX_PREFERRED_AGE}
        value={min}
        onChange={(e) => {
          const next = Number(e.target.value);
          setMin(next);
          if (next > max) setMax(next);
        }}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <label style={{ display: "block", fontSize: 12, color: "#6b7280" }}>Maximum: {max}</label>
      <input
        type="range"
        min={MIN_PREFERRED_AGE}
        max={MAX_PREFERRED_AGE}
        value={max}
        onChange={(e) => {
          const next = Number(e.target.value);
          setMax(next);
          if (next < min) setMin(next);
        }}
        style={{ width: "100%", marginBottom: 16 }}
      />

      <button onClick={() => onSubmit({ min, max })} style={{ width: "100%", padding: 10 }}>
        Continue
      </button>
    </div>
  );
}

function SearchRadiusStep({
  onSubmit,
  error,
}: {
  onSubmit: (data: { radiusKm: number; location?: { lat: number; lng: number } }) => void;
  error: string | null;
}) {
  const [radiusKm, setRadiusKm] = useState(25);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationStatus("granted");
      },
      () => setLocationStatus("denied"),
      { timeout: 10_000 }
    );
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>How far should we look?</label>
      <p style={{ fontSize: 18, fontWeight: 600, margin: "8px 0 16px" }}>
        {radiusKm} km {radiusKm === MAX_SEARCH_RADIUS_KM ? "(anywhere)" : ""}
      </p>
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      <input
        type="range"
        min={MIN_SEARCH_RADIUS_KM}
        max={MAX_SEARCH_RADIUS_KM}
        value={radiusKm}
        onChange={(e) => setRadiusKm(Number(e.target.value))}
        style={{ width: "100%", marginBottom: 16 }}
      />

      <div style={{ marginBottom: 16, padding: 12, background: "#f9fafb", borderRadius: 8, fontSize: 13 }}>
        {locationStatus === "granted" ? (
          <span style={{ color: "#16a34a" }}>Location enabled — we'll only ever share your approximate area, never an exact address.</span>
        ) : locationStatus === "denied" ? (
          <span style={{ color: "#6b7280" }}>No location — you can still set a radius, but we won't be able to sort by distance yet.</span>
        ) : (
          <>
            <p style={{ margin: "0 0 8px", color: "#6b7280" }}>
              Enable location to find people near you. We only ever use an approximate area — never your exact address.
            </p>
            <button onClick={requestLocation} disabled={locationStatus === "requesting"} style={{ padding: 8 }}>
              {locationStatus === "requesting" ? "Requesting…" : "Enable location"}
            </button>
          </>
        )}
      </div>

      <button onClick={() => onSubmit({ radiusKm, location: location ?? undefined })} style={{ width: "100%", padding: 10 }}>
        Continue
      </button>
    </div>
  );
}

// The onboarding user id resolves in priority order: an explicit ?userId=
// (useful for testing/demoing multiple users), then a stable id persisted
// in localStorage (see draftId.ts — this is what actually survives a
// closed tab or crash), generated once and reused from then on.
function OnboardingContent() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUserId(searchParams.get("userId") || getOrCreateDraftId());
  }, [searchParams]);

  const [state, setState] = useState<OnboardingState | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_URL}/api/onboarding/${userId}`)
      .then((res) => res.json())
      .then(setState);
  }, [userId]);

  const submitStep = async (step: string, stepValue: unknown) => {
    if (!userId) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/onboarding/${userId}/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
          Welcome, {state.profile.displayName}
          {state.profile.isSelfieVerified && <VerifiedBadge />}. Looking for{" "}
          {state.profile.datingGoal && DATING_GOAL_LABELS[state.profile.datingGoal].toLowerCase()}.
        </p>
      </main>
    );
  }

  const stepIndex = ONBOARDING_STEPS.indexOf(state.currentStep);

  return (
    <main style={{ maxWidth: 360, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Set up your profile</h1>
      <p style={{ fontSize: 11, color: "#9ca3af" }}>
        Your progress is saved automatically — closing this tab and coming back will pick up right here.
      </p>
      <div style={{ display: "flex", gap: 6, margin: "16px 0" }}>
        {ONBOARDING_STEPS.map((step, i) => (
          <div key={step} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= stepIndex ? "#2563eb" : "#e5e7eb" }} />
        ))}
      </div>

      {state.currentStep === "selfieVerification" ? (
        <LiveSelfieCapture userId={userId!} onDone={(verified) => submitStep("selfieVerification", verified ? {} : { skipped: true })} />
      ) : state.currentStep === "avatar" ? (
        <AvatarStep error={error} onSubmit={(avatarUrl) => submitStep("avatar", avatarUrl)} />
      ) : state.currentStep === "searchRadius" ? (
        <SearchRadiusStep error={error} onSubmit={(data) => submitStep("searchRadius", data)} />
      ) : state.currentStep === "ageRange" ? (
        <AgeRangeStep error={error} onSubmit={(data) => submitStep("ageRange", data)} />
      ) : state.currentStep === "orientation" ? (
        <OrientationStep error={error} onSubmit={(data) => submitStep("orientation", data)} />
      ) : state.currentStep === "gender" ? (
        <GenderStep error={error} onSubmit={(data) => submitStep("gender", data)} />
      ) : state.currentStep === "datingGoal" ? (
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

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingContent />
    </Suspense>
  );
}
