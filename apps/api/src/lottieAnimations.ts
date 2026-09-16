export interface LottieAnimationEntry {
  id: string;
  name: string;
  path: string;
}

/**
 * Tinder's real "Support for high-quality Lottie animations in the UI"
 * (#280): the served catalog of real Lottie JSON assets under
 * `apps/web/public/lottie/`, rendered client-side by the real `lottie-web`
 * player (see `LottieAnimation.tsx`) rather than a CSS/GIF stand-in. This
 * store just tracks which named animations exist so the client (or a
 * future admin tool) can look one up by id without hardcoding paths in
 * more than one place.
 */
export const LOTTIE_ANIMATION_CATALOG: LottieAnimationEntry[] = [
  { id: "match-celebration", name: "Match celebration", path: "/lottie/match-celebration.json" },
];

export function getLottieAnimationCatalog(): LottieAnimationEntry[] {
  return LOTTIE_ANIMATION_CATALOG;
}

export function findLottieAnimation(id: unknown): LottieAnimationEntry | undefined {
  return LOTTIE_ANIMATION_CATALOG.find((entry) => entry.id === id);
}
