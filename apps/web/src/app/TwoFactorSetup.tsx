"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// This UI calls the backend's 2FA endpoints directly with a client-supplied
// userId, matching a known limitation documented in apps/api/src/server.ts:
// those endpoints aren't gated behind a verified access token yet (no
// merged auth session to check against — see #21-#25), so this component
// is a demonstration of the setup flow, not yet safe to expose to real
// users signed in as someone else.
export default function TwoFactorSetup({ userId }: { userId: string }) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beginSetup = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/auth/2fa/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, accountLabel: userId }),
    });
    if (!res.ok) {
      setError("Failed to start 2FA setup");
      return;
    }
    const body = await res.json();
    setQrCodeDataUrl(body.qrCodeDataUrl);
    setSecret(body.secret);
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/api/auth/2fa/confirm-setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, token: code }),
    });
    if (!res.ok) {
      setError("Invalid code — check your authenticator app and try again");
      return;
    }
    setEnabled(true);
  };

  if (enabled) {
    return <p style={{ fontSize: 14, color: "#16a34a" }}>Two-factor authentication is enabled.</p>;
  }

  return (
    <div style={{ maxWidth: 320 }}>
      <h2 style={{ fontSize: 16 }}>Two-factor authentication</h2>
      {!qrCodeDataUrl && (
        <button onClick={beginSetup} style={{ padding: 10 }}>
          Set up with an authenticator app
        </button>
      )}
      {qrCodeDataUrl && (
        <form onSubmit={confirmSetup}>
          <p style={{ fontSize: 13, color: "#6b7280" }}>
            Scan this code with Google Authenticator, 1Password, or a similar app.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCodeDataUrl} alt="Two-factor authentication QR code" style={{ display: "block", marginBottom: 8 }} />
          <p style={{ fontSize: 11, color: "#9ca3af", wordBreak: "break-all" }}>Or enter manually: {secret}</p>
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            required
            style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box", letterSpacing: 4, textAlign: "center" }}
          />
          {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
          <button type="submit" style={{ width: "100%", padding: 10 }}>
            Confirm and enable
          </button>
        </form>
      )}
    </div>
  );
}
