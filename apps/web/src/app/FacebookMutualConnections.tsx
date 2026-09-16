"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface MutualConnectionEntry {
  author: string;
  mutualFriends: number;
}

/**
 * Tinder's real "Show Facebook mutual connections if the account is
 * linked" (#253) — the read-only counterpart to #77's SharedContacts.tsx:
 * no upload UI here since the friend list comes from #253's own
 * FacebookConnect.tsx settings-page connect flow, not pasted contacts.
 * Renders nothing until the author has actually connected Facebook.
 */
export default function FacebookMutualConnections({ author }: { author: string }) {
  const [connections, setConnections] = useState<MutualConnectionEntry[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/facebook-mutual-connections/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setConnections(body.candidates ?? []))
      .catch(() => {});
  }, [author]);

  if (connections.length === 0) return null;

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14 }}>🔵 Facebook mutual connections</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
        {connections.map((entry) => (
          <div
            key={entry.author}
            style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}
          >
            {entry.author} &middot; {entry.mutualFriends} mutual friend{entry.mutualFriends === 1 ? "" : "s"}
          </div>
        ))}
      </div>
    </section>
  );
}
