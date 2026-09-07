"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SpotifyInfo {
  connected: boolean;
  topTracks: string[];
  hideSpotify: boolean;
}

export default function SpotifyConnect({ author }: { author: string }) {
  const [info, setInfo] = useState<SpotifyInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/spotify-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setInfo(body.spotifyInfo ?? null))
      .catch(() => {});
  }, [author]);

  // The actual Spotify OAuth redirect (accounts.spotify.com/authorize) and
  // catching the ?code= callback is a full page-navigation flow outside
  // this component's scope; connect() assumes that flow already handed the
  // caller an authorization code, matching how #25's Facebook sign-in
  // button hands the server an already-obtained access token.
  const connect = async (code: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/spotify/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, code, redirectUri: `${window.location.origin}/spotify/callback` }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to connect Spotify");
      }
      setInfo(body.spotifyInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Spotify");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const res = await fetch(`${API_URL}/api/spotify/${encodeURIComponent(author)}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setInfo(body.spotifyInfo ?? null);
  };

  const toggleHide = async (hideSpotify: boolean) => {
    const res = await fetch(`${API_URL}/api/spotify-info/${encodeURIComponent(author)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideSpotify }),
    });
    const body = await res.json().catch(() => ({}));
    setInfo(body.spotifyInfo ?? null);
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Spotify</h2>
      {info?.connected ? (
        <div>
          <p style={{ color: "var(--color-muted)" }}>Top tracks:</p>
          <ul>
            {info.topTracks.map((track) => (
              <li key={track}>{track}</li>
            ))}
          </ul>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={info.hideSpotify} onChange={(e) => toggleHide(e.target.checked)} />
            Hide Spotify on my profile
          </label>
          <button onClick={disconnect} style={{ marginTop: 4 }}>
            Disconnect Spotify
          </button>
        </div>
      ) : (
        <button onClick={() => connect(window.prompt("Paste the Spotify authorization code:") ?? "")} disabled={busy}>
          Connect Spotify
        </button>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
