"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const CONFIRM_PHRASE = "DELETE";

export default function PrivacySettings() {
  const searchParams = useSearchParams();
  const [authorToDelete, setAuthorToDelete] = useState(() => searchParams.get("author") ?? "");
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<{ deletedRecordCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canDelete = authorToDelete.trim().length > 0 && confirmText === CONFIRM_PHRASE && !busy;

  const deleteAccount = async () => {
    if (!canDelete) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/account/${encodeURIComponent(authorToDelete.trim())}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to delete account data");
      setResult(body);
      try {
        window.localStorage.removeItem("chatapp:guestAuthor");
      } catch {
        // localStorage may be unavailable (private browsing, disabled storage) — safe to ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account data");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Privacy</h1>

      <section style={{ border: "1px solid #b00020", borderRadius: 8, padding: 12 }}>
        <h2 style={{ fontSize: 16 }}>Delete account and data</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          This permanently erases every message you&apos;ve sent under the display name below. This
          can&apos;t be undone.
        </p>

        {!result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              value={authorToDelete}
              onChange={(e) => setAuthorToDelete(e.target.value)}
              placeholder="Your display name"
              style={{ padding: 8 }}
            />
            <label style={{ fontSize: 12 }}>
              Type <strong>{CONFIRM_PHRASE}</strong> to confirm:
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              style={{ padding: 8 }}
            />
            <button
              onClick={deleteAccount}
              disabled={!canDelete}
              style={{ background: "#b00020", color: "white", border: "none", borderRadius: 6, padding: "10px 16px" }}
            >
              {busy ? "Deleting…" : "Permanently delete my data"}
            </button>
            {error && <p style={{ color: "#b00020" }}>{error}</p>}
          </div>
        )}

        {result && (
          <p>
            Done — {result.deletedRecordCount} record(s) deleted. You can keep using ChatApp under a
            new identity.
          </p>
        )}
      </section>
    </main>
  );
}
