"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface LiveEvent {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  createdBy: string;
}

/**
 * Match.com's real "in-app live events" (#155, e.g. a live speed-dating
 * night or Q&A) — no admin role exists in this app, so any author can
 * schedule one (same scoping call as #109's squads/#110's double dates).
 * Subscribing here just opts a viewer into the "it's starting" push
 * notification a server-side sweep sends once `startsAt` arrives — see
 * liveEvents.ts.
 */
export default function LiveEventsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = () => {
    fetch(`${API_URL}/api/live-events`)
      .then((res) => res.json())
      .then((body) => setEvents(body.events ?? []))
      .catch(() => {});
  };

  useEffect(loadEvents, []);

  const createEvent = async () => {
    if (!title.trim() || !startsAt) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/live-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createdBy: author,
          title: title.trim(),
          description: description.trim(),
          startsAt: new Date(startsAt).toISOString(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to create event");
      setTitle("");
      setDescription("");
      setStartsAt("");
      loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setBusy(false);
    }
  };

  const toggleSubscribe = (eventId: string) => {
    const isSubscribed = subscribed.has(eventId);
    const method = isSubscribed ? "DELETE" : "POST";
    fetch(`${API_URL}/api/live-events/${eventId}/subscribe`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    })
      .then((res) => {
        if (!res.ok) return;
        setSubscribed((prev) => {
          const next = new Set(prev);
          if (isSubscribed) next.delete(eventId);
          else next.add(eventId);
          return next;
        });
      })
      .catch(() => {});
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Live Events</h1>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>

      <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12 }}>
        <h2 style={{ fontSize: 14 }}>Schedule an event</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title (e.g. Speed Dating Night)"
          style={{ width: "100%", marginTop: 8 }}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          style={{ width: "100%", marginTop: 8 }}
        />
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          style={{ width: "100%", marginTop: 8 }}
        />
        <button onClick={createEvent} disabled={busy || !title.trim() || !startsAt} style={{ marginTop: 8 }}>
          Schedule event
        </button>
        {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14 }}>Upcoming events</h2>
        {events.length === 0 ? (
          <p style={{ color: "var(--color-muted)" }}>No upcoming events — schedule one above.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {events.map((event) => (
              <li
                key={event.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <div>
                  <p style={{ fontWeight: "bold" }}>{event.title}</p>
                  {event.description && <p style={{ color: "var(--color-muted)", fontSize: 13 }}>{event.description}</p>}
                  <p style={{ color: "var(--color-muted)", fontSize: 13 }}>{new Date(event.startsAt).toLocaleString()}</p>
                </div>
                <button onClick={() => toggleSubscribe(event.id)}>
                  {subscribed.has(event.id) ? "Notify: On" : "Notify me"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
