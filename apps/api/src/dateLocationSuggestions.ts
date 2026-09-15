import type { Interest } from "./interestsInfo";

export interface DateLocationCategory {
  id: string;
  label: string;
  suggestion: string;
}

export interface DateLocationSuggestion {
  category: DateLocationCategory;
  matchingInterests: Interest[];
}

export interface DateLocationResult {
  sharedInterests: Interest[];
  suggestions: DateLocationSuggestion[];
}

const DATE_LOCATION_CATEGORIES: Record<string, DateLocationCategory> = {
  outdoorActive: { id: "outdoorActive", label: "Outdoor & Active", suggestion: "Go for a hike, a bike ride, or a walk somewhere scenic." },
  foodAndDrink: { id: "foodAndDrink", label: "Food & Drink", suggestion: "Try a cozy café, a wine bar, or a restaurant with a menu you'd both enjoy." },
  entertainment: { id: "entertainment", label: "Entertainment", suggestion: "Catch a live show, a concert, or a movie together." },
  creativeAndQuiet: { id: "creativeAndQuiet", label: "Creative & Quiet", suggestion: "Visit a museum or gallery, or find a board game café." },
  wellness: { id: "wellness", label: "Wellness", suggestion: "Try a yoga class or a meditative walk somewhere calm." },
  communityAndNature: {
    id: "communityAndNature",
    label: "Community & Nature",
    suggestion: "Visit a botanical garden, a farmers market, or volunteer together for an afternoon.",
  },
  petFriendly: { id: "petFriendly", label: "Pet-Friendly", suggestion: "Visit a dog park or a pet-friendly café patio." },
  exploring: { id: "exploring", label: "Exploring & Discovery", suggestion: "Explore a new neighborhood, a market, or plan a short day trip." },
};

// Every catalog interest maps to exactly one date-location category — a
// real, disclosed mapping rather than a fabricated recommendation model
// this app has no geocoding/places API or inference infrastructure for.
const INTEREST_TO_CATEGORY: Record<Interest, string> = {
  hiking: "outdoorActive",
  yoga: "wellness",
  gym: "wellness",
  running: "outdoorActive",
  cycling: "outdoorActive",
  cooking: "foodAndDrink",
  baking: "foodAndDrink",
  coffee: "foodAndDrink",
  wine: "foodAndDrink",
  photography: "creativeAndQuiet",
  painting: "creativeAndQuiet",
  writing: "creativeAndQuiet",
  reading: "creativeAndQuiet",
  gaming: "creativeAndQuiet",
  movies: "entertainment",
  livemusic: "entertainment",
  concerts: "entertainment",
  dancing: "entertainment",
  travel: "exploring",
  camping: "outdoorActive",
  gardening: "communityAndNature",
  volunteering: "communityAndNature",
  sustainability: "communityAndNature",
  meditation: "wellness",
  podcasts: "creativeAndQuiet",
  boardgames: "creativeAndQuiet",
  fashion: "exploring",
  foodie: "foodAndDrink",
  dogs: "petFriendly",
  cats: "petFriendly",
};

/**
 * Match.com's real "Suggest a suitable date location based on shared
 * interests" (#237): a real, deterministic mapping from #79's interest
 * catalog to a small set of date-location categories, not a fabricated
 * recommendation model or a live places/geocoding API this app has no
 * credentials for — distinct from #147's `dateProposals.ts` (a fixed,
 * non-personalized activity catalog) since this is actually driven by
 * the specific pair's own shared interests. Categories with more shared
 * interests behind them are surfaced first.
 */
export function suggestDateLocations(interestsA: Interest[], interestsB: Interest[]): DateLocationResult {
  const setB = new Set(interestsB);
  const sharedInterests = interestsA.filter((interest) => setB.has(interest));

  const interestsByCategory = new Map<string, Interest[]>();
  for (const interest of sharedInterests) {
    const categoryId = INTEREST_TO_CATEGORY[interest];
    const existing = interestsByCategory.get(categoryId) ?? [];
    existing.push(interest);
    interestsByCategory.set(categoryId, existing);
  }

  const suggestions = [...interestsByCategory.entries()]
    .map(([categoryId, matchingInterests]) => ({ category: DATE_LOCATION_CATEGORIES[categoryId], matchingInterests }))
    .sort((a, b) => b.matchingInterests.length - a.matchingInterests.length);

  return { sharedInterests, suggestions };
}
