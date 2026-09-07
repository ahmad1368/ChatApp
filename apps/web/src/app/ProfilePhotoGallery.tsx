"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface PhotoNote {
  author: string;
  text: string;
  createdAt: string;
}

function PhotoCard({ owner, viewer, photoId }: { owner: string; viewer: string; photoId: string }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [notes, setNotes] = useState<PhotoNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);

  const loadLikes = () => {
    fetch(`${API_URL}/api/photo-likes/${encodeURIComponent(owner)}/${encodeURIComponent(photoId)}?viewer=${encodeURIComponent(viewer)}`)
      .then((res) => res.json())
      .then((body) => {
        setLiked(body.liked ?? false);
        setLikeCount(body.likeCount ?? 0);
      })
      .catch(() => {});
  };

  const loadNotes = () => {
    fetch(`${API_URL}/api/photo-notes/${encodeURIComponent(owner)}/${encodeURIComponent(photoId)}`)
      .then((res) => res.json())
      .then((body) => setNotes(body.notes ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    loadLikes();
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, viewer, photoId]);

  const toggleLike = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/photo-likes/${encodeURIComponent(owner)}/${encodeURIComponent(photoId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liker: viewer }),
      });
      if (res.ok) {
        const body = await res.json();
        setLiked(body.liked);
        setLikeCount(body.likeCount);
      }
    } finally {
      setBusy(false);
    }
  };

  const sendNote = async () => {
    if (!noteText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/photo-notes/${encodeURIComponent(owner)}/${encodeURIComponent(photoId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: viewer, text: noteText }),
      });
      if (res.ok) {
        setNoteText("");
        loadNotes();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 8, marginTop: 8 }}>
      <img
        src={`${API_URL}/api/photos/${encodeURIComponent(photoId)}?viewer=${encodeURIComponent(viewer)}`}
        alt="Profile"
        style={{ width: "100%", borderRadius: 6, display: "block" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <button onClick={toggleLike} disabled={busy || owner === viewer}>
          {liked ? "❤️" : "🤍"} {likeCount}
        </button>
      </div>
      {notes.length > 0 && (
        <ul style={{ marginTop: 6, paddingLeft: 16, fontSize: 12 }}>
          {notes.map((note, i) => (
            <li key={i}>
              <strong>{note.author}:</strong> {note.text}
            </li>
          ))}
        </ul>
      )}
      {owner !== viewer && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Leave a note on this photo"
            style={{ flex: 1, fontSize: 12 }}
            maxLength={300}
          />
          <button onClick={sendNote} disabled={busy || !noteText.trim()}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Hinge's real "like or comment on one specific photo" (#112) — each photo
 * in the owner's album (#59-#62) gets its own heart toggle and note thread,
 * distinct from a whole-profile swipe decision.
 */
export default function ProfilePhotoGallery({ owner, viewer }: { owner: string; viewer: string }) {
  const [photoIds, setPhotoIds] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(owner)}/photos`)
      .then((res) => res.json())
      .then((body) => setPhotoIds(body.photoIds ?? []))
      .catch(() => {});
  }, [owner]);

  if (photoIds.length === 0) return null;

  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 14 }}>Photos</h2>
      {photoIds.map((photoId) => (
        <PhotoCard key={photoId} owner={owner} viewer={viewer} photoId={photoId} />
      ))}
    </section>
  );
}
