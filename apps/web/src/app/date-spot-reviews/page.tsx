"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface DateSpotReview {
  id: string;
  venue: string;
  author: string;
  rating: number;
  text: string;
  createdAt: string;
}

interface DateSpotSummary {
  venue: string;
  averageRating: number;
  reviewCount: number;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Match.com's real "Ability to post reviews and experiences from good
 * date spots" (#229) — see dateSpotReviews.ts for the honest scoping (a
 * real named-venue review with a 1-5 rating and free text).
 */
export default function DateSpotReviewsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [venues, setVenues] = useState<DateSpotSummary[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [reviews, setReviews] = useState<DateSpotReview[]>([]);
  const [summary, setSummary] = useState<DateSpotSummary | null>(null);
  const [venueInput, setVenueInput] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadVenues = () => {
    fetch(`${API_URL}/api/date-spot-reviews/venues`)
      .then((res) => res.json())
      .then((body) => setVenues(body.venues ?? []))
      .catch(() => {});
  };

  useEffect(loadVenues, []);

  const openVenue = (venue: string) => {
    setSelectedVenue(venue);
    fetch(`${API_URL}/api/date-spot-reviews?venue=${encodeURIComponent(venue)}`)
      .then((res) => res.json())
      .then((body) => {
        setReviews(body.reviews ?? []);
        setSummary(body.summary ?? null);
      })
      .catch(() => {});
  };

  const post = async () => {
    setError(null);
    const venue = selectedVenue ?? venueInput;
    const res = await fetch(`${API_URL}/api/date-spot-reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, venue, rating, text }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to post review");
      return;
    }
    setText("");
    setVenueInput("");
    loadVenues();
    openVenue(venue);
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Date Spot Reviews</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {!selectedVenue && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {venues.map((v) => (
              <button
                key={v.venue}
                onClick={() => openVenue(v.venue)}
                style={{ textAlign: "left", border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, cursor: "pointer" }}
              >
                <p style={{ fontWeight: 700, margin: 0 }}>{v.venue}</p>
                <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 0" }}>
                  {v.averageRating.toFixed(1)} &#9733; &middot; {v.reviewCount} review{v.reviewCount === 1 ? "" : "s"}
                </p>
              </button>
            ))}
            {venues.length === 0 && <p style={{ color: "var(--color-muted)" }}>No reviews yet — be the first to post one.</p>}
          </div>
        </>
      )}

      {selectedVenue && (
        <button onClick={() => setSelectedVenue(null)} style={{ marginBottom: 12 }}>
          &larr; All Spots
        </button>
      )}

      {selectedVenue && summary && (
        <p style={{ color: "var(--color-muted)" }}>
          {summary.averageRating.toFixed(1)} &#9733; average across {summary.reviewCount} review{summary.reviewCount === 1 ? "" : "s"}
        </p>
      )}

      <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>{selectedVenue ? `Review ${selectedVenue}` : "Post a review"}</h3>
        {!selectedVenue && (
          <input
            value={venueInput}
            onChange={(e) => setVenueInput(e.target.value)}
            placeholder="Venue name (e.g. Blue Bottle Coffee)"
            style={{ width: "100%", marginBottom: 8 }}
          />
        )}
        <div style={{ marginBottom: 8 }}>
          {STARS.map((s) => (
            <button key={s} onClick={() => setRating(s)} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>
              {s <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share your experience"
          style={{ width: "100%", marginBottom: 8, minHeight: 60 }}
        />
        <button onClick={post} disabled={!text.trim() || (!selectedVenue && !venueInput.trim())}>
          Post Review
        </button>
      </div>

      {selectedVenue && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reviews.map((review) => (
            <div key={review.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
              <p style={{ fontWeight: 700, margin: 0 }}>
                {review.author} &middot; {"★".repeat(review.rating)}
                {"☆".repeat(5 - review.rating)}
              </p>
              <p style={{ margin: "4px 0 0" }}>{review.text}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
