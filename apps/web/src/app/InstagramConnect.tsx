"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface InstagramInfo {
  connected: boolean;
  posts: string[];
  hideInstagram: boolean;
}

export default function InstagramConnect({ author }: { author: string }) {
  const [info, setInfo] = useState<InstagramInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/instagram-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setInfo(body.instagramInfo ?? null))
      .catch(() => {});
  }, [author]);

  // Same scope trade-off as #77's SpotifyConnect: the actual Instagram OAuth
  // redirect + ?code= callback page is out of scope here, so this assumes
  // the caller already has an authorization code.
  const connect = async (code: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/instagram/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, code, redirectUri: `${window.location.origin}/instagram/callback` }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to connect Instagram");
      }
      setInfo(body.instagramInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Instagram");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const res = await fetch(`${API_URL}/api/instagram/${encodeURIComponent(author)}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setInfo(body.instagramInfo ?? null);
  };

  const toggleHide = async (hideInstagram: boolean) => {
    const res = await fetch(`${API_URL}/api/instagram-info/${encodeURIComponent(author)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideInstagram }),
    });
    const body = await res.json().catch(() => ({}));
    setInfo(body.instagramInfo ?? null);
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Instagram</h2>
      {info?.connected ? (
        <div>
          <p style={{ color: "var(--color-muted)" }}>Latest posts:</p>
          <ul>
            {info.posts.map((post) => (
              <li key={post}>
                <a href={post} target="_blank" rel="noreferrer">
                  {post}
                </a>
              </li>
            ))}
          </ul>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={info.hideInstagram} onChange={(e) => toggleHide(e.target.checked)} />
            Hide Instagram on my profile
          </label>
          <button onClick={disconnect} style={{ marginTop: 4 }}>
            Disconnect Instagram
          </button>
        </div>
      ) : (
        <button onClick={() => connect(window.prompt("Paste the Instagram authorization code:") ?? "")} disabled={busy}>
          Connect Instagram
        </button>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
