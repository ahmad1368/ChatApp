"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface PartnerVenue {
  id: string;
  name: string;
  category: string;
  city: string;
  discountDescription: string;
}

/**
 * Match.com's real "Suggest dates at venues with special discounts for
 * app users" (#306) — see partnerVenueDiscounts.ts for the real fixed
 * partner catalog and per-author claim codes.
 */
export default function DateVenueDiscountsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [venues, setVenues] = useState<PartnerVenue[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busyVenueId, setBusyVenueId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/partner-venues`)
      .then((res) => res.json())
      .then((body) => setVenues(body.venues ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    venues.forEach((venue) => {
      fetch(`${API_URL}/api/partner-venues/${encodeURIComponent(venue.id)}/claim?author=${encodeURIComponent(author)}`)
        .then((res) => res.json())
        .then((body) => {
          if (body.code) setCodes((prev) => ({ ...prev, [venue.id]: body.code }));
        })
        .catch(() => {});
    });
  }, [venues, author]);

  const claim = async (venueId: string) => {
    setError(null);
    setBusyVenueId(venueId);
    try {
      const res = await fetch(`${API_URL}/api/partner-venues/${encodeURIComponent(venueId)}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to claim discount");
      setCodes((prev) => ({ ...prev, [venueId]: body.code }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim discount");
    } finally {
      setBusyVenueId(null);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Date venues with special discounts</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        A curated list of partner venues offering app users a discount for a date. Claim a code and show it at the
        venue — codes aren&apos;t verified electronically, so bring your phone.
      </p>

      {error && <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        {venues.map((venue) => (
          <div key={venue.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
            <p style={{ fontWeight: 700, margin: 0 }}>{venue.name}</p>
            <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 0" }}>
              {venue.category} &middot; {venue.city}
            </p>
            <p style={{ margin: "4px 0 0" }}>{venue.discountDescription}</p>
            {codes[venue.id] ? (
              <p style={{ marginTop: 8, fontWeight: 700 }}>Your code: {codes[venue.id]}</p>
            ) : (
              <button onClick={() => claim(venue.id)} disabled={busyVenueId === venue.id} style={{ marginTop: 8 }}>
                {busyVenueId === venue.id ? "Claiming…" : "Claim discount"}
              </button>
            )}
          </div>
        ))}
        {venues.length === 0 && <p style={{ color: "var(--color-muted)" }}>No partner venues available right now.</p>}
      </div>
    </main>
  );
}
