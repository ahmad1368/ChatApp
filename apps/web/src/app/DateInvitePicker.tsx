"use client";

import { useState } from "react";

export interface DateInviteSharePayload {
  location: string;
  proposedAt: string;
  note?: string;
}

/**
 * Bumble's real "send a date invitation within chat" (#146): a proposed
 * real-world meetup (where, when, and an optional note) sent as its own
 * card the recipient can accept or decline — see server.ts's message:send
 * for the dateInvite validation and date-invite:respond for the response.
 */
export default function DateInvitePicker({
  onSend,
  onClose,
}: {
  onSend: (payload: DateInviteSharePayload) => void;
  onClose: () => void;
}) {
  const [location, setLocation] = useState("");
  const [proposedAt, setProposedAt] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    if (!location.trim()) {
      setError("Add a location for the date");
      return;
    }
    const parsed = new Date(proposedAt);
    if (!proposedAt || Number.isNaN(parsed.getTime())) {
      setError("Pick a valid date and time");
      return;
    }
    setError(null);
    onSend({ location: location.trim(), proposedAt: parsed.toISOString(), note: note.trim() || undefined });
  };

  return (
    <div className="chat-app__date-invite-picker">
      <input
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Where? (e.g. The coffee shop on 5th)"
        className="chat-app__input"
      />
      <input
        type="datetime-local"
        value={proposedAt}
        onChange={(e) => setProposedAt(e.target.value)}
        className="chat-app__input"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        className="chat-app__input"
      />
      <div className="chat-app__date-invite-picker-actions">
        <button onClick={send}>📅 Send date invitation</button>
        <button onClick={onClose}>✕</button>
      </div>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
