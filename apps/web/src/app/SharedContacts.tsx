"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SharedContactEntry {
  author: string;
  sharedContacts: number;
}

/**
 * Tinder's real Facebook-friends "X mutual friends" signal (#114), rebuilt
 * on #17's phone-contact hashing since this app has no Facebook Graph API
 * integration — see contactsGraph.ts. Uploading here replaces (not merges)
 * the author's previously uploaded list, same as #17's own contact upload.
 */
export default function SharedContacts({ author }: { author: string }) {
  const [contactsText, setContactsText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [shared, setShared] = useState<SharedContactEntry[]>([]);

  const loadShared = () => {
    fetch(`${API_URL}/api/shared-contacts/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setShared(body.candidates ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    loadShared();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  const uploadContacts = async () => {
    const phoneNumbers = contactsText
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (phoneNumbers.length === 0) return;
    const res = await fetch(`${API_URL}/api/contact-graph/${encodeURIComponent(author)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumbers }),
    });
    if (res.ok) {
      const body = await res.json();
      setStatus(`Uploaded ${body.contactCount} contact(s).`);
      setContactsText("");
      loadShared();
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14 }}>👥 People you may know</h2>
      <p style={{ color: "var(--color-muted)", fontSize: 12 }}>
        Paste phone numbers from your contacts (one per line) to find candidates you have contacts in common with.
      </p>
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        <textarea
          value={contactsText}
          onChange={(e) => setContactsText(e.target.value)}
          placeholder={"555-111-2222\n555-333-4444"}
          rows={2}
          style={{ flex: 1, maxWidth: 240, fontSize: 12 }}
        />
        <button onClick={uploadContacts} disabled={!contactsText.trim()}>
          Upload
        </button>
      </div>
      {status && <p style={{ fontSize: 12, color: "var(--color-muted)" }}>{status}</p>}
      {shared.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
          {shared.map((entry) => (
            <div
              key={entry.author}
              style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}
            >
              {entry.author} &middot; {entry.sharedContacts} mutual contact{entry.sharedContacts === 1 ? "" : "s"}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
