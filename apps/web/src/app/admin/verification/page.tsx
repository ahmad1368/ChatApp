"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface QueueEntry {
  userId: string;
  submittedAt: string;
}

/**
 * Raya's real "Admin system to approve verification badges" (#174). The
 * selfie image is fetched as a blob (not a plain `<img src>`, since the
 * admin-key header can't ride along on an <img> request) and shown as an
 * object URL — the one place this app's admin surface is allowed to view
 * a submitted selfie at all (see verification.ts's privacy note).
 */
export default function AdminVerificationPage() {
  const [adminKey, setAdminKey] = useState("");
  const [queue, setQueue] = useState<QueueEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selfieUrls, setSelfieUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    return () => {
      Object.values(selfieUrls).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadQueue = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/verification-queue`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load queue");
      setQueue(null);
      return;
    }
    setQueue(body.queue);
  };

  const loadSelfie = async (userId: string) => {
    const res = await fetch(`${API_URL}/api/admin/verification-queue/${userId}/selfie`, {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    setSelfieUrls((prev) => ({ ...prev, [userId]: URL.createObjectURL(blob) }));
  };

  const review = async (userId: string, status: "approved" | "rejected") => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/verification-queue/${userId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ reviewer: "admin", status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to record decision");
      return;
    }
    setQueue((prev) => prev?.filter((entry) => entry.userId !== userId) ?? null);
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Verification badge queue</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadQueue();
        }}
        style={{ display: "flex", gap: 8, marginTop: 16 }}
      >
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Admin key"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={!adminKey}>
          Load queue
        </button>
      </form>

      {error && <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{error}</p>}

      {queue && queue.length === 0 && <p style={{ color: "var(--color-muted)", marginTop: 16 }}>Nothing pending.</p>}

      {queue && queue.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {queue.map((entry) => (
            <li
              key={entry.userId}
              style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}
            >
              <p style={{ margin: 0 }}>
                <strong>{entry.userId}</strong> — submitted {new Date(entry.submittedAt).toLocaleString()}
              </p>
              {selfieUrls[entry.userId] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selfieUrls[entry.userId]} alt="Submitted selfie" style={{ maxWidth: 200, marginTop: 8, borderRadius: 8 }} />
              ) : (
                <button onClick={() => loadSelfie(entry.userId)} style={{ marginTop: 8 }}>
                  View selfie
                </button>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => review(entry.userId, "approved")}>Approve</button>
                <button onClick={() => review(entry.userId, "rejected")}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
