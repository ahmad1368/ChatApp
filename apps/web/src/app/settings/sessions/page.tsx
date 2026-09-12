"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuth, loadStoredAuth, clearStoredAuth } from "../../authClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Session {
  id: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = () => {
    fetchWithAuth(`${API_URL}/api/auth/sessions`)
      .then((res) => (res.ok ? res.json() : undefined))
      .then((body) => body && setSessions(body.sessions ?? []))
      .catch(() => undefined);
  };

  useEffect(() => {
    if (!loadStoredAuth()) return;
    setSignedIn(true);
    refresh();
  }, []);

  const revoke = async (sessionId: string) => {
    setStatus(null);
    const res = await fetchWithAuth(`${API_URL}/api/auth/sessions/${sessionId}`, { method: "DELETE" });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(body.error ?? "Failed to log out that device");
    }
  };

  const revokeOthers = async () => {
    setStatus(null);
    const res = await fetchWithAuth(`${API_URL}/api/auth/sessions/others`, { method: "DELETE" });
    if (res.ok) {
      const body = await res.json();
      setStatus(`Logged out ${body.revokedCount} other device(s).`);
      refresh();
    }
  };

  // Tinder's real "Log out of the account from all devices" (#170) —
  // unlike revokeOthers() above, this includes this device too, so the
  // local session is cleared and there's nothing left to refresh().
  const revokeAll = async () => {
    setStatus(null);
    const res = await fetchWithAuth(`${API_URL}/api/auth/sessions/all`, { method: "DELETE" });
    if (res.ok) {
      const body = await res.json();
      clearStoredAuth();
      setSessions([]);
      setSignedIn(false);
      setStatus(`Logged out of all ${body.revokedCount} device(s), including this one.`);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/settings/security">&larr; Back to Security</Link>
      </p>
      <h1>Active sessions</h1>
      <p style={{ color: "#666", fontSize: 13 }}>Devices currently signed in to your account.</p>

      {!signedIn && !status && <p style={{ color: "#b00020" }}>Sign in first to manage your sessions.</p>}

      {signedIn && (
        <>
          {sessions.map((session) => (
            <div key={session.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <strong>{session.deviceLabel}</strong>
              {session.isCurrent && <span style={{ color: "#16a34a", marginLeft: 6, fontSize: 12 }}>(this device)</span>}
              <p style={{ fontSize: 12, color: "#666" }}>Last active: {new Date(session.lastUsedAt).toLocaleString()}</p>
              {!session.isCurrent && <button onClick={() => revoke(session.id)}>Log out</button>}
            </div>
          ))}
          {sessions.length > 1 && (
            <button onClick={revokeOthers} style={{ marginTop: 8 }}>
              Log out of all other devices
            </button>
          )}
          <button onClick={revokeAll} style={{ marginTop: 8, marginLeft: 8 }}>
            Log out of all devices
          </button>
        </>
      )}
      {status && <p style={{ fontSize: 13, color: "#6b7280" }}>{status}</p>}
    </main>
  );
}
