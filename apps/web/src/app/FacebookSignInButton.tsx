"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

interface FacebookLoginResponse {
  authResponse?: { accessToken: string };
  status: string;
}

declare global {
  interface Window {
    FB?: {
      init: (config: { appId: string; version: string; xfbml: boolean }) => void;
      login: (callback: (response: FacebookLoginResponse) => void, options: { scope: string }) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export default function FacebookSignInButton({ onSignedIn }: { onSignedIn: (auth: unknown) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!FACEBOOK_APP_ID) return;

    window.fbAsyncInit = () => {
      window.FB?.init({ appId: FACEBOOK_APP_ID, version: "v19.0", xfbml: false });
      setReady(true);
    };

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleClick = () => {
    setError(null);
    window.FB?.login(async (response) => {
      const accessToken = response.authResponse?.accessToken;
      if (!accessToken) {
        setError("Facebook sign-in was cancelled or denied");
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/auth/facebook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Facebook sign-in failed");
        }
        onSignedIn(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Facebook sign-in failed");
      }
    }, { scope: "public_profile,email" });
  };

  if (!FACEBOOK_APP_ID) {
    return (
      <button disabled title="Facebook Sign-In is not configured for this deployment" style={{ width: "100%", padding: 10 }}>
        Sign in with Facebook (not configured)
      </button>
    );
  }

  return (
    <div>
      <button onClick={handleClick} disabled={!ready} style={{ width: "100%", padding: 10, background: "#1877f2", color: "#fff", border: "none" }}>
        Sign in with Facebook
      </button>
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
    </div>
  );
}
