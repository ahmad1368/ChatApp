"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface QueueEntry {
  photoId: string;
  author: string;
  status: string;
}

/**
 * Bumble's real "Smart and manual review of uploaded photos" (#172).
 * The queue is already sorted highest-report-count-first by the server
 * (see photoReview.ts) — this page just renders it and lets an admin
 * decide. Deliberately doesn't render a photo thumbnail: GET
 * /api/photos/:id enforces #59's per-album view-access level (private/
 * request-access), which an arbitrary "admin" viewer string wouldn't
 * satisfy — building a real admin bypass for that is a separate, larger
 * change than this issue's queue-and-decide workflow, so it's left as a
 * disclosed gap rather than faking a working image preview.
 */
export default function AdminPhotoReviewPage() {
  const [adminKey, setAdminKey] = useState("");
  const [queue, setQueue] = useState<QueueEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonByPhotoId, setReasonByPhotoId] = useState<Record<string, string>>({});

  const loadQueue = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/photo-review-queue`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load queue");
      setQueue(null);
      return;
    }
    setQueue(body.queue);
  };

  const decide = async (photoId: string, status: "approved" | "rejected") => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/photo-review/${photoId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ reviewer: "admin", status, reason: reasonByPhotoId[photoId] || undefined }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to record decision");
      return;
    }
    setQueue((prev) => prev?.filter((entry) => entry.photoId !== photoId) ?? null);
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Photo review queue</h1>

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
              key={entry.photoId}
              style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8 }}
            >
              <p>
                <strong>{entry.author}</strong> — photo <code>{entry.photoId}</code>
              </p>
              <input
                type="text"
                placeholder="Reason (optional)"
                value={reasonByPhotoId[entry.photoId] ?? ""}
                onChange={(e) => setReasonByPhotoId((prev) => ({ ...prev, [entry.photoId]: e.target.value }))}
                style={{ width: "100%", padding: 6, marginBottom: 8, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => decide(entry.photoId, "approved")}>Approve</button>
                <button onClick={() => decide(entry.photoId, "rejected")}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
