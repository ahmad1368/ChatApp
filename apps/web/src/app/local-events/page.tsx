"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface LocalSinglesEvent {
  id: string;
  title: string;
  description: string;
  city: string;
  venue: string;
  startsAt: string;
  capacity: number;
}

/**
 * Match.com's real "Local singles events calendar" (#227) — see
 * localSinglesEvents.ts for the honest scoping (admin-curated events,
 * distinct from #221/#222's member-hosted /group-events, browsable by
 * city and calendar month).
 */
export default function LocalEventsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [events, setEvents] = useState<LocalSinglesEvent[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [month, setMonth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rsvpStatusByEvent, setRsvpStatusByEvent] = useState<Record<string, string>>({});

  const load = () => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (month) params.set("month", month);
    fetch(`${API_URL}/api/local-events?${params.toString()}`)
      .then((res) => res.json())
      .then((body) => setEvents(body.events ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetch(`${API_URL}/api/local-events/cities`)
      .then((res) => res.json())
      .then((body) => setCities(body.cities ?? []))
      .catch(() => {});
  }, []);

  useEffect(load, [city, month]);

  const rsvp = async (eventId: string) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/local-events/${eventId}/rsvp`, {
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
      <h1>Local Singles Events</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select value={city} onChange={(e) => setCity(e.target.value)} style={{ flex: 1 }}>
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ flex: 1 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {events.map((event) => (
          <div key={event.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
            <p style={{ fontWeight: 700, margin: 0 }}>{event.title}</p>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "4px 0" }}>
              {new Date(event.startsAt).toLocaleString()} &middot; {event.venue}, {event.city}
            </p>
            {event.description && <p style={{ margin: "4px 0", fontSize: 13 }}>{event.description}</p>}
            <button onClick={() => rsvp(event.id)} disabled={!!rsvpStatusByEvent[event.id]}>
              {rsvpStatusByEvent[event.id] === "confirmed"
                ? "You're going!"
                : rsvpStatusByEvent[event.id] === "waitlisted"
                  ? "Waitlisted"
                  : "RSVP"}
            </button>
          </div>
        ))}
        {events.length === 0 && <p style={{ color: "var(--color-muted)" }}>No local events match your filters yet.</p>}
      </div>
    </main>
  );
}
