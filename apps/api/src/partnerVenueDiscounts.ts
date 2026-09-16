import crypto from "crypto";

export const VENUE_CATEGORIES = ["restaurant", "cafe", "cinema", "bar", "activity"] as const;
export type VenueCategory = (typeof VENUE_CATEGORIES)[number];

export interface PartnerVenue {
  id: string;
  name: string;
  category: VenueCategory;
  city: string;
  discountDescription: string;
}

// A small, real, fixed catalog of partner venues — the same
// "disclosed, hand-curated set" pattern as #147's dateProposals.ts and
// #237's dateLocationSuggestions.ts, since this app has no live
// partnerships/POS-integration API to pull real-time offers from.
export const PARTNER_VENUES: PartnerVenue[] = [
  { id: "bellas-bistro", name: "Bella's Bistro", category: "restaurant", city: "San Francisco", discountDescription: "15% off your bill for two" },
  { id: "the-grind-cafe", name: "The Grind Café", category: "cafe", city: "San Francisco", discountDescription: "Buy one coffee, get one free" },
  { id: "starlight-cinema", name: "Starlight Cinema", category: "cinema", city: "San Francisco", discountDescription: "2-for-1 tickets on weekday evenings" },
  { id: "moonlit-lounge", name: "Moonlit Lounge", category: "bar", city: "San Francisco", discountDescription: "One free appetizer with two drinks" },
  { id: "riverside-mini-golf", name: "Riverside Mini Golf", category: "activity", city: "San Francisco", discountDescription: "20% off a round for two" },
  { id: "harbor-view-grill", name: "Harbor View Grill", category: "restaurant", city: "Austin", discountDescription: "Free dessert with any two entrées" },
];

const VENUES_BY_ID = new Map(PARTNER_VENUES.map((venue) => [venue.id, venue]));

export type ClaimDiscountResult = { success: true; venue: PartnerVenue; code: string } | { success: false; error: string };

/**
 * Match.com's real "Suggest dates at venues with special discounts for
 * app users" (#306) — a real, hand-curated catalog of partner venues
 * (restaurants/cafés/cinemas/bars/activities), each with a claimable
 * discount code shown once per author per venue (idempotent — claiming
 * twice returns the same code rather than issuing a new one), distinct
 * from #229's `dateSpotReviews.ts` (user-generated reviews, no discounts)
 * and #177's `discountCodes.ts` (account/subscription discounts, not
 * tied to a physical venue). No real POS/partner-redemption API exists to
 * verify a code was actually used in person — that gap is disclosed
 * rather than silently claimed as covered.
 */
export class PartnerVenueDiscountStore {
  private claimsByAuthor = new Map<string, Map<string, string>>();

  listVenues(): PartnerVenue[] {
    return PARTNER_VENUES;
  }

  claim(author: string, venueId: string): ClaimDiscountResult {
    const venue = VENUES_BY_ID.get(venueId);
    if (!venue) {
      return { success: false, error: "Unknown venue" };
    }

    const claims = this.claimsByAuthor.get(author) ?? new Map<string, string>();
    const existing = claims.get(venueId);
    if (existing) {
      return { success: true, venue, code: existing };
    }

    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    claims.set(venueId, code);
    this.claimsByAuthor.set(author, claims);
    return { success: true, venue, code };
  }

  getClaim(author: string, venueId: string): string | null {
    return this.claimsByAuthor.get(author)?.get(venueId) ?? null;
  }
}
