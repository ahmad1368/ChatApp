"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ExportData() {
  const searchParams = useSearchParams();
  const [author, setAuthor] = useState(() => searchParams.get("author") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const downloadBackup = async () => {
    const trimmed = author.trim();
    if (!trimmed) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/account/${encodeURIComponent(trimmed)}/export`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to export your data");

      const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `chatapp-data-${trimmed}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export your data");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Download your data</h1>

      <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
        <h2 style={{ fontSize: 16 }}>Personal data backup</h2>
        <p style={{ color: "#666", fontSize: 13 }}>
          Get a JSON copy of every message you&apos;ve sent under the display name below.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your display name"
            style={{ padding: 8 }}
          />
          <button
            onClick={downloadBackup}
            disabled={!author.trim() || busy}
            style={{ background: "#0070f3", color: "white", border: "none", borderRadius: 6, padding: "10px 16px" }}
          >
            {busy ? "Preparing…" : "Download my data"}
          </button>
          {error && <p style={{ color: "#b00020" }}>{error}</p>}
        </div>
      </section>
    </main>
  );
}
