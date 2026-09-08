export interface SharedSignals {
  interests: string[];
  musicTracks: string[];
  weekendPlans: string[];
  bioKeywords: string[];
}

export const DEFAULT_ICEBREAKER_LIMIT = 5;

// Hinge's real "designed to be deleted" conversation-starter tone —
// open-ended, low-pressure questions rather than yes/no ones. Used to
// fill out the suggestion list when a pair has few or no shared signals.
const GENERIC_ICEBREAKERS = [
  "What's the best trip you've ever taken?",
  "What's something you're really passionate about right now?",
  "If you could have dinner with anyone, who would it be?",
  "What's your go-to order at your favorite restaurant?",
  "What's a small thing that makes your day better?",
];

/**
 * "AI-suggested conversation starters" (#132) — genuinely personalized
 * from this app's real shared-signal computations (#94's interest
 * overlap, #118's music match, #119's weekend-plan match, #120's bio
 * keyword match) rather than an invented LLM call this app has no model
 * or API key for; same honest-heuristic scoping call as #95's Smart
 * Score and #107's fake-profile detector. Generic Hinge-style prompts
 * fill out the list when a pair has few or no shared signals, so there's
 * always something to suggest.
 */
export function generateIcebreakers(shared: SharedSignals, limit: number = DEFAULT_ICEBREAKER_LIMIT): string[] {
  const suggestions: string[] = [];
  for (const interest of shared.interests) {
    suggestions.push(`I noticed we're both into ${interest} — how'd you get started with that?`);
  }
  for (const track of shared.musicTracks) {
    suggestions.push(`We both have "${track}" in our top tracks — what's on repeat for you lately?`);
  }
  for (const plan of shared.weekendPlans) {
    suggestions.push(`Looks like we're both up for ${plan} this weekend — got any recommendations?`);
  }
  for (const keyword of shared.bioKeywords) {
    suggestions.push(`I saw "${keyword}" in your bio — tell me more about that!`);
  }

  let genericIndex = 0;
  while (suggestions.length < limit && genericIndex < GENERIC_ICEBREAKERS.length) {
    suggestions.push(GENERIC_ICEBREAKERS[genericIndex]);
    genericIndex++;
  }

  return suggestions.slice(0, limit);
}
