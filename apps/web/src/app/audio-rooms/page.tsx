"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AudioRoomSummary {
  id: string;
  title: string;
  description: string;
  host: string;
  createdAt: string;
  speakerCount: number;
  listenerCount: number;
}

interface AudioRoomDetails extends AudioRoomSummary {
  speakers: string[];
  listeners: string[];
  raisedHands: string[];
}

/**
 * Match.com's real "Support for podcasts or group audio rooms" (#225) —
 * see audioRooms.ts for the honest scoping (real live-membership and
 * moderation; no SFU in this app's infra to actually mix N-way audio).
 */
export default function AudioRoomsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [rooms, setRooms] = useState<AudioRoomSummary[]>([]);
  const [room, setRoom] = useState<AudioRoomDetails | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadRooms = () => {
    fetch(`${API_URL}/api/audio-rooms`)
      .then((res) => res.json())
      .then((body) => setRooms(body.rooms ?? []))
      .catch(() => {});
  };

  useEffect(loadRooms, []);

  const loadRoom = (roomId: string) => {
    fetch(`${API_URL}/api/audio-rooms/${roomId}`)
      .then((res) => res.json())
      .then((body) => setRoom(body.room ?? null))
      .catch(() => {});
  };

  const createRoom = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/audio-rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: author, title, description }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to create room");
      return;
    }
    setTitle("");
    setDescription("");
    loadRooms();
    loadRoom(body.room.id);
  };

  const join = async (roomId: string) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/audio-rooms/${roomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to join room");
      return;
    }
    setRoom(body.room);
  };

  const leave = async () => {
    if (!room) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/audio-rooms/${room.id}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to leave room");
      return;
    }
    setRoom(null);
    loadRooms();
  };

  const raiseHand = async () => {
    if (!room) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/audio-rooms/${room.id}/raise-hand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to raise hand");
      return;
    }
    loadRoom(room.id);
  };

  const inviteToSpeak = async (target: string) => {
    if (!room) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/audio-rooms/${room.id}/invite-to-speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: author, author: target }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to invite to speak");
      return;
    }
    setRoom(body.room);
  };

  const isMember = room ? room.speakers.includes(author) || room.listeners.includes(author) : false;
  const isHost = room?.host === author;

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Audio Rooms</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {!room && (
        <>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Start a room</h3>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Dating in your 30s)"
              style={{ width: "100%", marginBottom: 8 }}
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this room about?"
              style={{ width: "100%", marginBottom: 8 }}
            />
            <button onClick={createRoom} disabled={!title.trim()}>
              Start Room
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => join(r.id)}
                style={{ textAlign: "left", border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, cursor: "pointer" }}
              >
                <p style={{ fontWeight: 700, margin: 0 }}>{r.title}</p>
                {r.description && <p style={{ margin: "4px 0", fontSize: 13 }}>{r.description}</p>}
                <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0 }}>
                  {r.speakerCount} speaking &middot; {r.listenerCount} listening
                </p>
              </button>
            ))}
            {rooms.length === 0 && <p style={{ color: "var(--color-muted)" }}>No rooms live right now — start one.</p>}
          </div>
        </>
      )}

      {room && (
        <>
          <button onClick={leave} style={{ marginBottom: 12 }}>
            &larr; Leave Room
          </button>
          <h2 style={{ marginBottom: 0 }}>{room.title}</h2>
          {room.description && <p style={{ color: "var(--color-muted)", marginTop: 4 }}>{room.description}</p>}

          <h3 style={{ fontSize: 14 }}>Speaking</h3>
          <ul style={{ paddingLeft: 20 }}>
            {room.speakers.map((s) => (
              <li key={s}>
                {s} {s === room.host && "(host)"}
              </li>
            ))}
          </ul>

          <h3 style={{ fontSize: 14 }}>Listening</h3>
          <ul style={{ paddingLeft: 20 }}>
            {room.listeners.map((l) => (
              <li key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {l}
                {room.raisedHands.includes(l) && <span>✋</span>}
                {isHost && <button onClick={() => inviteToSpeak(l)}>Invite to speak</button>}
              </li>
            ))}
            {room.listeners.length === 0 && <li style={{ listStyle: "none", marginLeft: -20, color: "var(--color-muted)" }}>No listeners yet.</li>}
          </ul>

          {isMember && !room.speakers.includes(author) && (
            <button onClick={raiseHand} disabled={room.raisedHands.includes(author)}>
              {room.raisedHands.includes(author) ? "Hand raised" : "Raise hand"}
            </button>
          )}
        </>
      )}
    </main>
  );
}
