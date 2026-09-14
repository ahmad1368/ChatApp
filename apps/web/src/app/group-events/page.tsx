"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type GroupEventType = "webinar" | "game" | "cafe" | "outdoor";
const IN_PERSON_TYPES: GroupEventType[] = ["cafe", "outdoor"];

interface GroupEvent {
  id: string;
  host: string;
  title: string;
  description: string;
  type: GroupEventType;
  startsAt: string;
  capacity: number;
  location?: string;
}

/**
 * Match.com's real "Create online group events (webinars, games)"
 * (#221) and "Create real group dates at cafes or in nature" (#222) —
 * see groupEvents.ts for the honest scoping (one shared capacity-limited
 * RSVP-with-waitlist engine; #222's in-person types just add a required
 * location).
 */
export default function GroupEventsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<GroupEventType>("game");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [rsvpStatusByEvent, setRsvpStatusByEvent] = useState<Record<string, string>>({});
  const isInPerson = IN_PERSON_TYPES.includes(type);

  const load = () => {
    fetch(`${API_URL}/api/group-events`)
      .then((res) => res.json())
      .then((body) => setEvents(body.events ?? []))
      .catch(() => {});
  };

  useEffect(load, []);

  const create = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/group-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: author, title, type, location, startsAt: new Date(startsAt).toISOString(), capacity }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to create event");
      return;
    }
    setTitle("");
    load();
  };

  const rsvp = async (eventId: string) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/group-events/${eventId}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to RSVP");
      return;
    }
    setRsvpStatusByEvent((prev) => ({ ...prev, [eventId]: body.status }));
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Group Events &amp; Dates</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Create an event</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ width: "100%", marginBottom: 8 }} />
        <select value={type} onChange={(e) => setType(e.target.value as GroupEventType)} style={{ width: "100%", marginBottom: 8 }}>
          <option value="game">Online game night</option>
          <option value="webinar">Webinar</option>
          <option value="cafe">Group date at a cafe</option>
          <option value="outdoor">Group date in nature</option>
        </select>
        {isInPerson && (
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (e.g. Blue Bottle Coffee)"
            style={{ width: "100%", marginBottom: 8 }}
          />
        )}
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <input
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
          placeholder="Capacity"
          style={{ width: "100%", marginBottom: 8 }}
        />
        <button onClick={create} disabled={!title.trim() || !startsAt || (isInPerson && !location.trim())}>
          Create
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {events.map((event) => (
          <div key={event.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
            <p style={{ fontWeight: 700, margin: 0 }}>
              {event.title} <span style={{ fontWeight: 400, fontSize: 13, color: "var(--color-muted)" }}>({event.type})</span>
            </p>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "4px 0" }}>
              {new Date(event.startsAt).toLocaleString()} &middot; hosted by {event.host} &middot; capacity {event.capacity}
              {event.location && <> &middot; {event.location}</>}
            </p>
            <button onClick={() => rsvp(event.id)} disabled={!!rsvpStatusByEvent[event.id]}>
              {rsvpStatusByEvent[event.id] === "confirmed"
                ? "You're going!"
                : rsvpStatusByEvent[event.id] === "waitlisted"
                  ? "Waitlisted"
                  : "RSVP"}
            </button>
          </div>
        ))}
        {events.length === 0 && <p style={{ color: "var(--color-muted)" }}>No upcoming events yet.</p>}
      </div>
    </main>
  );
}
