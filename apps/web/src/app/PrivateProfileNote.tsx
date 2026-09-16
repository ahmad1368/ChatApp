"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Tinder's real "Ability to add a private note on someone's profile
 * (visible only to you)" (#307) — see profileNotes.ts. Only ever shown to
 * the viewer who wrote it; the subject of the note never sees this.
 */
export default function PrivateProfileNote({ viewer, subject }: { viewer: string; subject: string }) {
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/profile-notes/${encodeURIComponent(subject)}?viewer=${encodeURIComponent(viewer)}`)
      .then((res) => res.json())
      .then((body) => {
        setNote(body.note ?? "");
        setDraft(body.note ?? "");
      })
      .catch(() => {});
  }, [viewer, subject]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/profile-notes/${encodeURIComponent(subject)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewer, text: draft }),
      });
      if (res.ok) {
        const body = await res.json();
        setNote(body.note ?? "");
        setEditing(false);
      }
    } finally {
      setBusy(false);
    }
  };

  if (viewer === subject) return null;

  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 8, marginTop: 12 }}>
      <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "0 0 6px" }}>🔒 Private note (only you can see this)</p>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            placeholder="Add a private note about this profile"
            style={{ width: "100%", minHeight: 50, fontSize: 13 }}
          />
          <div>
            <button onClick={save} disabled={busy}>
              Save
            </button>
            <button
              onClick={() => {
                setDraft(note);
                setEditing(false);
              }}
              disabled={busy}
              style={{ marginLeft: 6 }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{ fontSize: 13, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {note || "Add a private note"}
        </button>
      )}
    </div>
  );
}
