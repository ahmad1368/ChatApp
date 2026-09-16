"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface PhotoNote {
  author: string;
  text: string;
  createdAt: string;
}

interface PhotoReactionSummary {
  emoji: string;
  count: number;
}

function PhotoCard({ owner, viewer, photoId }: { owner: string; viewer: string; photoId: string }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [notes, setNotes] = useState<PhotoNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [altText, setAltText] = useState("");
  const [altTextDraft, setAltTextDraft] = useState("");
  const [editingAltText, setEditingAltText] = useState(false);
  const [reactionEmojis, setReactionEmojis] = useState<string[]>([]);
  const [reactionSummary, setReactionSummary] = useState<PhotoReactionSummary[]>([]);
  const [viewerReaction, setViewerReaction] = useState<string | null>(null);

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

  const loadAltText = () => {
    fetch(`${API_URL}/api/photos/${encodeURIComponent(owner)}/${encodeURIComponent(photoId)}/alt-text`)
      .then((res) => res.json())
      .then((body) => {
        setAltText(body.altText ?? "");
        setAltTextDraft(body.altText ?? "");
      })
      .catch(() => {});
  };

  const loadReactions = () => {
    fetch(`${API_URL}/api/photos/${encodeURIComponent(photoId)}/reactions?viewer=${encodeURIComponent(viewer)}`)
      .then((res) => res.json())
      .then((body) => {
        setReactionSummary(body.summary ?? []);
        setViewerReaction(body.viewerReaction ?? null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadLikes();
    loadNotes();
    loadAltText();
    loadReactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, viewer, photoId]);

  useEffect(() => {
    fetch(`${API_URL}/api/photo-reactions/emojis`)
      .then((res) => res.json())
      .then((body) => setReactionEmojis(body.emojis ?? []))
      .catch(() => {});
  }, []);

  const pickReaction = async (emoji: string) => {
    setBusy(true);
    try {
      if (viewerReaction === emoji) {
        await fetch(`${API_URL}/api/photos/${encodeURIComponent(photoId)}/reaction`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewer }),
        });
      } else {
        await fetch(`${API_URL}/api/photos/${encodeURIComponent(photoId)}/reaction`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewer, emoji }),
        });
      }
      loadReactions();
    } finally {
      setBusy(false);
    }
  };

  const saveAltText = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/photos/${encodeURIComponent(owner)}/${encodeURIComponent(photoId)}/alt-text`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: altTextDraft }),
      });
      if (res.ok) {
        const body = await res.json();
        setAltText(body.altText ?? "");
        setEditingAltText(false);
      }
    } finally {
      setBusy(false);
    }
  };

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
        alt={altText || `${owner}'s profile photo`}
        style={{ width: "100%", borderRadius: 6, display: "block" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <button onClick={toggleLike} disabled={busy || owner === viewer}>
          {liked ? "❤️" : "🤍"} {likeCount}
        </button>
      </div>
      {reactionEmojis.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 6 }}>
          {reactionEmojis.map((emoji) => {
            const summaryEntry = reactionSummary.find((s) => s.emoji === emoji);
            const selected = viewerReaction === emoji;
            return (
              <button
                key={emoji}
                onClick={() => pickReaction(emoji)}
                disabled={busy}
                aria-pressed={selected}
                style={{
                  fontSize: 13,
                  padding: "2px 6px",
                  borderRadius: 12,
                  border: selected ? "1px solid var(--color-accent, #e0245e)" : "1px solid var(--color-border)",
                  background: selected ? "var(--color-accent-muted, rgba(224,36,94,0.12))" : "none",
                  cursor: "pointer",
                }}
              >
                {emoji} {summaryEntry ? summaryEntry.count : ""}
              </button>
            );
          })}
        </div>
      )}
      {owner === viewer &&
        (editingAltText ? (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input
              type="text"
              value={altTextDraft}
              onChange={(e) => setAltTextDraft(e.target.value)}
              placeholder="Describe this photo for screen readers"
              style={{ flex: 1, fontSize: 12 }}
              maxLength={250}
            />
            <button onClick={saveAltText} disabled={busy}>
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingAltText(true)}
            style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {altText ? `Alt text: "${altText}" (edit)` : "Add alt text for accessibility"}
          </button>
        ))}
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

interface BestPhotoSuggestion {
  ranked: { photoId: string; likeCount: number; noteCount: number; score: number }[];
  suggestedPhotoId: string | null;
  hasEnoughFeedback: boolean;
}

/**
 * Hinge's real "Automatic suggestion of the best photos based on
 * others' feedback" (#232) — only shown to the album's own owner, and
 * only once #112's like/note engagement gives it real signal to act on
 * (see bestPhotoSuggestion.ts).
 */
function BestPhotoBanner({ owner, photoIds, onReordered }: { owner: string; photoIds: string[]; onReordered: () => void }) {
  const [suggestion, setSuggestion] = useState<BestPhotoSuggestion | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/photos/${encodeURIComponent(owner)}/best-photo-suggestion`)
      .then((res) => res.json())
      .then(setSuggestion)
      .catch(() => {});
  }, [owner, photoIds]);

  if (!suggestion?.suggestedPhotoId || suggestion.suggestedPhotoId === photoIds[0]) return null;

  const makePrimary = async () => {
    setBusy(true);
    try {
      const reordered = [suggestion.suggestedPhotoId!, ...photoIds.filter((id) => id !== suggestion.suggestedPhotoId)];
      const res = await fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(owner)}/photos/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: reordered }),
      });
      if (res.ok) onReordered();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 8, marginBottom: 8, fontSize: 13 }}>
      Based on likes and notes from others, your best-performing photo isn&apos;t your primary one.
      <button onClick={makePrimary} disabled={busy} style={{ marginLeft: 8 }}>
        Make it primary
      </button>
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

  const loadPhotoIds = () => {
    fetch(`${API_URL}/api/photo-albums/${encodeURIComponent(owner)}/photos`)
      .then((res) => res.json())
      .then((body) => setPhotoIds(body.photoIds ?? []))
      .catch(() => {});
  };

  useEffect(loadPhotoIds, [owner]);

  if (photoIds.length === 0) return null;

  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 14 }}>Photos</h2>
      {owner === viewer && <BestPhotoBanner owner={owner} photoIds={photoIds} onReordered={loadPhotoIds} />}
      {photoIds.map((photoId) => (
        <PhotoCard key={photoId} owner={owner} viewer={viewer} photoId={photoId} />
      ))}
    </section>
  );
}
