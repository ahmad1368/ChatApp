"use client";

import { useState } from "react";
import { REPORT_REASONS, REPORT_REASON_LABELS, ReportReason } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Props {
  reporterAuthor: string;
  reportedAuthor: string;
  messageId?: string;
  onClose: () => void;
}

export default function ReportDialog({ reporterAuthor, reportedAuthor, messageId, onClose }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporterAuthor, reportedAuthor, messageId, reason, details: details || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to submit report");
      }
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
      setStatus("idle");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report user"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 8, padding: 20, width: 320, fontSize: 14 }}>
        {status === "done" ? (
          <>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Report submitted</h2>
            <p style={{ color: "#6b7280" }}>Thanks — our team will review this.</p>
            <button onClick={onClose} style={{ width: "100%", padding: 10 }}>
              Close
            </button>
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Report {reportedAuthor}</h2>
            {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {REPORT_REASONS.map((option) => (
                <label key={option} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="radio" name="reason" checked={reason === option} onChange={() => setReason(option)} />
                  {REPORT_REASON_LABELS[option]}
                </label>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Additional details (optional)"
              rows={3}
              style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 10 }}>
                Cancel
              </button>
              <button onClick={submit} disabled={!reason || status === "submitting"} style={{ flex: 1, padding: 10 }}>
                {status === "submitting" ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
