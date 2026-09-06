"use client";

import { useEffect, useRef, useState } from "react";
import { getDeviceFingerprint } from "./deviceFingerprint";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
          renderButton: (parent: HTMLElement, options: { theme: string; size: string }) => void;
        };
      };
    };
  }
}

export default function GoogleSignInButton({ onSignedIn }: { onSignedIn: (auth: unknown) => void }) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const handleCredential = async (response: GoogleCredentialResponse) => {
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: response.credential, deviceFingerprint: getDeviceFingerprint() }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Google sign-in failed");
        }
        onSignedIn(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google sign-in failed");
      }
    };

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
      window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large" });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [onSignedIn]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button disabled title="Google Sign-In is not configured for this deployment" style={{ width: "100%", padding: 10 }}>
        Sign in with Google (not configured)
      </button>
    );
  }

  return (
    <div>
      <div ref={buttonRef} />
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
    </div>
  );
}
