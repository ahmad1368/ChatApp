"use client";

import { useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface EventTicket {
  eventId: string;
  attendee: string;
  host: string;
  token: string;
  issuedAt: string;
  checkedInAt: string | null;
}

/**
 * Match.com's real "Ability to confirm event attendance with a QR code"
 * (#230) — see eventCheckIns.ts for the honest scoping (a generic
 * per-event ticket usable against any RSVP'd event from /group-events,
 * /local-events, or /interest-groups). No camera-based scanner UI here —
 * the host confirms by entering the token decoded from the attendee's QR
 * code, same as any external QR-scanner app would surface it.
 */
export default function EventCheckInPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [error, setError] = useState<string | null>(null);

  const [attendeeEventId, setAttendeeEventId] = useState("");
  const [attendeeHost, setAttendeeHost] = useState("");
  const [ticket, setTicket] = useState<EventTicket | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  const [hostEventId, setHostEventId] = useState("");
  const [roster, setRoster] = useState<EventTicket[]>([]);
  const [scanToken, setScanToken] = useState("");

  const getMyTicket = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/event-check-ins/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: attendeeEventId, host: attendeeHost, attendee: author }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to get ticket");
      return;
    }
    setTicket(body.ticket);
    setQrCodeDataUrl(body.qrCodeDataUrl);
  };

  const loadRoster = () => {
    setError(null);
    fetch(`${API_URL}/api/event-check-ins/${encodeURIComponent(hostEventId)}`)
      .then((res) => res.json())
      .then((body) => setRoster(body.tickets ?? []))
      .catch(() => {});
  };

  const confirmCheckIn = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/event-check-ins/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scannedBy: author, token: scanToken }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to check in");
      return;
    }
    setScanToken("");
    loadRoster();
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Event Check-In</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>My ticket</h3>
        <input
          value={attendeeEventId}
          onChange={(e) => setAttendeeEventId(e.target.value)}
          placeholder="Event ID"
          style={{ width: "100%", marginBottom: 8 }}
        />
        <input
          value={attendeeHost}
          onChange={(e) => setAttendeeHost(e.target.value)}
          placeholder="Event host's name"
          style={{ width: "100%", marginBottom: 8 }}
        />
        <button onClick={getMyTicket} disabled={!attendeeEventId.trim() || !attendeeHost.trim()}>
          Get My QR Ticket
        </button>

        {ticket && qrCodeDataUrl && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCodeDataUrl} alt="Check-in QR code" style={{ width: 180, height: 180 }} />
            <p style={{ fontSize: 12, color: "var(--color-muted)" }}>
              {ticket.checkedInAt ? `Checked in ${new Date(ticket.checkedInAt).toLocaleString()}` : "Show this to the host at the door"}
            </p>
          </div>
        )}
      </div>

      <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Host: check attendees in</h3>
        <input
          value={hostEventId}
          onChange={(e) => setHostEventId(e.target.value)}
          placeholder="Event ID"
          style={{ width: "100%", marginBottom: 8 }}
        />
        <button onClick={loadRoster} disabled={!hostEventId.trim()} style={{ marginBottom: 8 }}>
          Load Roster
        </button>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={scanToken} onChange={(e) => setScanToken(e.target.value)} placeholder="Scanned token" style={{ flex: 1 }} />
          <button onClick={confirmCheckIn} disabled={!scanToken.trim()}>
            Confirm
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {roster.map((t) => (
            <div key={t.attendee} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>{t.attendee}</span>
              <span style={{ color: t.checkedInAt ? "var(--color-success, green)" : "var(--color-muted)" }}>
                {t.checkedInAt ? "Checked in" : "Not yet"}
              </span>
            </div>
          ))}
          {roster.length === 0 && <p style={{ color: "var(--color-muted)", fontSize: 13 }}>No tickets issued for this event yet.</p>}
        </div>
      </div>
    </main>
  );
}
