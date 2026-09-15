"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface VenueCheckIn {
  author: string;
  venue: string;
  checkedInAt: string;
  expiresAt: string;
}

interface VenueSummary {
  venue: string;
  checkedInCount: number;
}

/**
 * Match.com's real "Check-in at public places and see who's there" (#224)
 * — see venueCheckIns.ts for the honest scoping (a single active check-in
 * per person, expiring a few hours after check-in).
 */
export default function CheckInPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [myCheckIn, setMyCheckIn] = useState<VenueCheckIn | null>(null);
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<VenueCheckIn[]>([]);
  const [venueInput, setVenueInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadMine = () => {
    fetch(`${API_URL}/api/venue-check-ins/mine/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setMyCheckIn(body.checkIn ?? null))
      .catch(() => {});
  };

  const loadVenues = () => {
    fetch(`${API_URL}/api/venue-check-ins/venues`)
      .then((res) => res.json())
      .then((body) => setVenues(body.venues ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    loadMine();
    loadVenues();
  }, []);

  const openVenue = (venue: string) => {
    setSelectedVenue(venue);
    fetch(`${API_URL}/api/venue-check-ins/venues/at?venue=${encodeURIComponent(venue)}`)
      .then((res) => res.json())
      .then((body) => setAttendees(body.checkIns ?? []))
      .catch(() => {});
  };

  const checkIn = async (venue: string) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/venue-check-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, venue }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to check in");
      return;
    }
    setVenueInput("");
    setMyCheckIn(body.checkIn);
    loadVenues();
    if (selectedVenue) openVenue(selectedVenue);
  };

  const checkOut = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/venue-check-ins/${encodeURIComponent(author)}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to check out");
      return;
    }
    setMyCheckIn(null);
    loadVenues();
    if (selectedVenue) openVenue(selectedVenue);
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Check In</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        {myCheckIn ? (
          <>
            <p style={{ margin: 0 }}>
              You&apos;re checked in at <strong>{myCheckIn.venue}</strong>
            </p>
            <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 8px" }}>
              Expires {new Date(myCheckIn.expiresAt).toLocaleTimeString()}
            </p>
            <button onClick={checkOut}>Check out</button>
          </>
        ) : (
          <>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Check in somewhere</h3>
            <input
              value={venueInput}
              onChange={(e) => setVenueInput(e.target.value)}
              placeholder="Venue name (e.g. Blue Bottle Coffee)"
              style={{ width: "100%", marginBottom: 8 }}
            />
            <button onClick={() => checkIn(venueInput)} disabled={!venueInput.trim()}>
              Check In
            </button>
          </>
        )}
      </div>

      <h2 style={{ fontSize: 16 }}>Busy right now</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {venues.map((v) => (
          <button
            key={v.venue}
            onClick={() => openVenue(v.venue)}
            style={{ textAlign: "left", border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, cursor: "pointer" }}
          >
            <p style={{ fontWeight: 700, margin: 0 }}>{v.venue}</p>
            <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 0" }}>
              {v.checkedInCount} {v.checkedInCount === 1 ? "person" : "people"} checked in
            </p>
          </button>
        ))}
        {venues.length === 0 && <p style={{ color: "var(--color-muted)" }}>No one's checked in anywhere yet.</p>}
      </div>

      {selectedVenue && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
          <p style={{ fontWeight: 700, margin: 0 }}>Who&apos;s at {selectedVenue}</p>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
            {attendees.map((a) => (
              <li key={a.author}>{a.author}</li>
            ))}
            {attendees.length === 0 && <li style={{ color: "var(--color-muted)", listStyle: "none", marginLeft: -20 }}>No one right now.</li>}
          </ul>
        </div>
      )}
    </main>
  );
}
