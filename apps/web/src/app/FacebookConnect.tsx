"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface FacebookConnectInfo {
  connected: boolean;
  friendIds: string[];
  hideFacebookFriends: boolean;
}

/**
 * Tinder's real "Show Facebook mutual connections if the account is
 * linked" (#253) — same shape as #77's SpotifyConnect.tsx: the actual
 * Facebook OAuth redirect is a full page-navigation flow outside this
 * component's scope, so connect() assumes the caller already has an
 * access token, same as #24's Facebook sign-in button. Only mutual
 * *counts* (never the raw friend id list) are ever shown on another
 * profile — see facebookConnect.ts and the /api/facebook-mutual-
 * connections route.
 */
export default function FacebookConnect({ author }: { author: string }) {
  const [info, setInfo] = useState<FacebookConnectInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/facebook-connect/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setInfo(body.facebookConnect ?? null))
      .catch(() => {});
  }, [author]);

  const connect = async (accessToken: string) => {
    if (!accessToken) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/facebook-connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, accessToken }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to connect Facebook");
      }
      setInfo(body.facebookConnect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Facebook");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const res = await fetch(`${API_URL}/api/facebook-connect/${encodeURIComponent(author)}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setInfo(body.facebookConnect ?? null);
  };

  const toggleHide = async (hideFacebookFriends: boolean) => {
    const res = await fetch(`${API_URL}/api/facebook-connect/${encodeURIComponent(author)}/hide`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideFacebookFriends }),
    });
    const body = await res.json().catch(() => ({}));
    setInfo(body.facebookConnect ?? null);
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Facebook</h2>
      {info?.connected ? (
        <div>
          <p style={{ color: "var(--color-muted)" }}>
            Connected — {info.friendIds.length} friend{info.friendIds.length === 1 ? "" : "s"} who also use ChatApp
            via Facebook.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={info.hideFacebookFriends} onChange={(e) => toggleHide(e.target.checked)} />
            Hide mutual friends on my profile
          </label>
          <button onClick={disconnect} style={{ marginTop: 4 }}>
            Disconnect Facebook
          </button>
        </div>
      ) : (
        <button onClick={() => connect(window.prompt("Paste your Facebook access token:") ?? "")} disabled={busy}>
          Connect Facebook
        </button>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
