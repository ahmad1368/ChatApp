"use client";

import { useState } from "react";
import { loadStoredAuth } from "./authClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function TwoFactorSetup() {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = loadStoredAuth();
  if (!auth) {
    return <p style={{ fontSize: 14, color: "#6b7280" }}>Sign in to set up two-factor authentication.</p>;
  }
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${auth.tokens.accessToken}` };

  const beginSetup = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/auth/2fa/setup`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ accountLabel: auth.user.displayName }),
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
      headers: authHeaders,
      body: JSON.stringify({ token: code }),
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
