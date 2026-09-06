"use client";

import { useState } from "react";
import Link from "next/link";
import { DATE_STATUSES, DATE_STATUS_LABELS, DateStatus, SharedDate } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ShareMyDate() {
  const [author] = useState(() => `guest-${Math.floor(Math.random() * 1000)}`);
  const [meetingWith, setMeetingWith] = useState("");
  const [location, setLocation] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [contactNames, setContactNames] = useState("");
  const [sharedDate, setSharedDate] = useState<SharedDate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  const create = async () => {
    setError(null);
    const names = contactNames
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    const res = await fetch(`${API_URL}/api/shared-dates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author,
        meetingWith,
        location,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : "",
        contactNames: names,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Failed to create shared date");
      return;
    }
    setSharedDate(body);
    setRevoked(false);
  };

  const setStatus = async (status: DateStatus) => {
    if (!sharedDate) return;
    const res = await fetch(`${API_URL}/api/shared-dates/${sharedDate.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, status }),
    });
    if (res.ok) setSharedDate(await res.json());
  };

  const revoke = async () => {
    if (!sharedDate) return;
    const res = await fetch(`${API_URL}/api/shared-dates/${sharedDate.id}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    });
    if (res.status === 204) setRevoked(true);
  };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Share My Date</h1>
      <p style={{ color: "#666" }}>
        Give one or more trusted friends a live link to your date plan — they&apos;ll see updates
        as you check in.
      </p>

      {!sharedDate && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={meetingWith}
            onChange={(e) => setMeetingWith(e.target.value)}
            placeholder="Who are you meeting?"
            style={{ padding: 8 }}
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Where are you meeting?"
            style={{ padding: 8 }}
          />
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            style={{ padding: 8 }}
          />
          <input
            value={contactNames}
            onChange={(e) => setContactNames(e.target.value)}
            placeholder="Trusted contacts, comma-separated (e.g. Sam, Priya)"
            style={{ padding: 8 }}
          />
          <button onClick={create} style={{ alignSelf: "flex-start" }}>
            Start sharing
          </button>
          {error && <p style={{ color: "#b00020" }}>{error}</p>}
        </div>
      )}

      {sharedDate && !revoked && (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
          <p>
            Meeting <strong>{sharedDate.meetingWith}</strong> at <strong>{sharedDate.location}</strong>
          </p>
          <p>
            Status: <strong>{DATE_STATUS_LABELS[sharedDate.status]}</strong>
          </p>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {DATE_STATUSES.map((status) => (
              <button key={status} onClick={() => setStatus(status)} disabled={sharedDate.status === status}>
                {DATE_STATUS_LABELS[status]}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 13, color: "#666" }}>Links for your trusted contacts:</p>
          <ul style={{ fontSize: 13 }}>
            {sharedDate.contacts.map((contact) => (
              <li key={contact.shareCode}>
                {contact.name}: {`${typeof window !== "undefined" ? window.location.origin : ""}/share-my-date/shared/${contact.shareCode}`}
              </li>
            ))}
          </ul>

          <button onClick={revoke} style={{ color: "#b00020" }}>
            Stop sharing
          </button>
        </div>
      )}

      {revoked && <p>Sharing stopped. Your trusted contacts can no longer view this plan.</p>}
    </main>
  );
}
