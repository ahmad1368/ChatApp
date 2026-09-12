"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Report {
  id: string;
  reporterAuthor: string;
  reason: string;
  details?: string;
  createdAt: string;
}

interface QueueEntry {
  reportedAuthor: string;
  pendingCount: number;
  reports: Report[];
}

/**
 * Bumble's real "Reported users management (Reported Users Queue)"
 * (#173). The queue is already grouped by reported author and sorted by
 * pending-report count (see reports.ts's getReportedUsersQueue()) —
 * this page renders it and lets an admin resolve or dismiss each
 * individual report.
 */
export default function AdminReportsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [queue, setQueue] = useState<QueueEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteByReportId, setNoteByReportId] = useState<Record<string, string>>({});

  const loadQueue = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/reported-users`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load queue");
      setQueue(null);
      return;
    }
    setQueue(body.queue);
  };

  const review = async (reportId: string, status: "resolved" | "dismissed") => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/reports/${reportId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ reviewer: "admin", status, note: noteByReportId[reportId] || undefined }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to record decision");
      return;
    }
    setQueue(
      (prev) =>
        prev
          ?.map((entry) => ({ ...entry, reports: entry.reports.filter((r) => r.id !== reportId) }))
          .filter((entry) => entry.reports.length > 0) ?? null
    );
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Reported users queue</h1>

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

      {queue &&
        queue.map((entry) => (
          <div
            key={entry.reportedAuthor}
            style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 16 }}
          >
            <h2 style={{ fontSize: 16, margin: 0 }}>
              {entry.reportedAuthor} — {entry.pendingCount} pending report{entry.pendingCount === 1 ? "" : "s"}
            </h2>
            {entry.reports.map((report) => (
              <div key={report.id} style={{ borderTop: "1px solid var(--color-border)", paddingTop: 8, marginTop: 8 }}>
                <p style={{ margin: 0, fontSize: 13 }}>
                  <strong>{report.reason}</strong> — reported by {report.reporterAuthor} on{" "}
                  {new Date(report.createdAt).toLocaleString()}
                </p>
                {report.details && <p style={{ margin: "4px 0", fontSize: 13, color: "var(--color-muted)" }}>{report.details}</p>}
                <input
                  type="text"
                  placeholder="Resolution note (optional)"
                  value={noteByReportId[report.id] ?? ""}
                  onChange={(e) => setNoteByReportId((prev) => ({ ...prev, [report.id]: e.target.value }))}
                  style={{ width: "100%", padding: 6, margin: "6px 0", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => review(report.id, "resolved")}>Resolve</button>
                  <button onClick={() => review(report.id, "dismissed")}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        ))}
    </main>
  );
}
