"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const APPLE_SERVICES_ID = process.env.NEXT_PUBLIC_APPLE_SERVICES_ID;
const APPLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI;

interface AppleAuthorizationResponse {
  authorization: { id_token: string };
}

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
        signIn: () => Promise<AppleAuthorizationResponse>;
      };
    };
  }
}

export default function AppleSignInButton({ onSignedIn }: { onSignedIn: (auth: unknown) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!APPLE_SERVICES_ID || !APPLE_REDIRECT_URI) return;

    const script = document.createElement("script");
    script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.async = true;
    script.onload = () => {
      window.AppleID?.auth.init({
        clientId: APPLE_SERVICES_ID,
        scope: "email",
        redirectURI: APPLE_REDIRECT_URI,
        usePopup: true,
      });
      setReady(true);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleClick = async () => {
    setError(null);
    try {
      const result = await window.AppleID!.auth.signIn();
      const res = await fetch(`${API_URL}/api/auth/apple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: result.authorization.id_token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Apple sign-in failed");
      }
      onSignedIn(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apple sign-in failed");
    }
  };

  if (!APPLE_SERVICES_ID || !APPLE_REDIRECT_URI) {
    return (
      <button disabled title="Sign in with Apple is not configured for this deployment" style={{ width: "100%", padding: 10 }}>
        Sign in with Apple (not configured)
      </button>
    );
  }

  return (
    <div>
      <button onClick={handleClick} disabled={!ready} style={{ width: "100%", padding: 10, background: "#000", color: "#fff", border: "none" }}>
         Sign in with Apple
      </button>
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
    </div>
  );
}
