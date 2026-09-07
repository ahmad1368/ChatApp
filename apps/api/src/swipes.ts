export const SWIPE_DIRECTIONS = ["like", "pass"] as const;
export type SwipeDirection = (typeof SWIPE_DIRECTIONS)[number];

export type RecordSwipeResult = { success: true; matched: boolean } | { success: false; error: string };
export type JoinDiscoveryResult = { success: true } | { success: false; error: string };

function isSwipeDirection(value: unknown): value is SwipeDirection {
  return typeof value === "string" && (SWIPE_DIRECTIONS as readonly string[]).includes(value);
}

/**
 * Tinder's real swipe-card mechanic (#91): a like/pass decision on a
 * candidate, with a match recorded the moment both sides have liked each
 * other. The implementation guide's Kafka/Redis-backed recommendation
 * service and 60fps native gesture layer are real production-scale
 * infrastructure this repo has no equivalent of (no message queue, no
 * cache layer, no react-native-reanimated dependency) — same kind of
 * scoping call as #77/#78's OAuth integrations documenting what a full
 * SDK integration would need. What's implemented here is the actual
 * decision/match engine: recording a swipe, detecting mutual likes, and a
 * simple opt-in candidate pool (`joinDiscovery`) other authors get shown
 * from, filtered by an injected block-check so blocked authors never
 * appear in each other's queues — the caller wires that to #16's
 * BlockStore rather than this module importing it directly, keeping this
 * store testable without the rest of the app's safety stores.
 */
export class SwipeStore {
  private candidates = new Set<string>();
  private swipesBySwiper = new Map<string, Map<string, SwipeDirection>>();
  private matchesByAuthor = new Map<string, Set<string>>();

  joinDiscovery(author: unknown): JoinDiscoveryResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    this.candidates.add(authorName);
    return { success: true };
  }

  leaveDiscovery(author: string): void {
    this.candidates.delete(author);
  }

  getCandidates(author: string, isBlockedEitherWay: (a: string, b: string) => boolean, limit = 10): string[] {
    const swiped = this.swipesBySwiper.get(author);
    const result: string[] = [];
    for (const candidate of this.candidates) {
      if (candidate === author) continue;
      if (swiped?.has(candidate)) continue;
      if (isBlockedEitherWay(author, candidate)) continue;
      result.push(candidate);
      if (result.length >= limit) break;
    }
    return result;
  }

  recordSwipe(swiper: unknown, swiped: unknown, direction: unknown): RecordSwipeResult {
    const swiperName = typeof swiper === "string" ? swiper.trim() : "";
    const swipedName = typeof swiped === "string" ? swiped.trim() : "";
    if (!swiperName || !swipedName) {
      return { success: false, error: "swiper and swiped are required" };
    }
    if (swiperName === swipedName) {
      return { success: false, error: "Cannot swipe on yourself" };
    }
    if (!isSwipeDirection(direction)) {
      return { success: false, error: `direction must be one of: ${SWIPE_DIRECTIONS.join(", ")}` };
    }

    const swiperMap = this.swipesBySwiper.get(swiperName) ?? new Map<string, SwipeDirection>();
    if (swiperMap.has(swipedName)) {
      return { success: false, error: "Already swiped on this profile" };
    }
    swiperMap.set(swipedName, direction);
    this.swipesBySwiper.set(swiperName, swiperMap);

    let matched = false;
    if (direction === "like" && this.swipesBySwiper.get(swipedName)?.get(swiperName) === "like") {
      matched = true;
      this.recordMatch(swiperName, swipedName);
    }

    return { success: true, matched };
  }

  private recordMatch(a: string, b: string): void {
    const setA = this.matchesByAuthor.get(a) ?? new Set<string>();
    setA.add(b);
    this.matchesByAuthor.set(a, setA);

    const setB = this.matchesByAuthor.get(b) ?? new Set<string>();
    setB.add(a);
    this.matchesByAuthor.set(b, setB);
  }

  getMatches(author: string): string[] {
    return [...(this.matchesByAuthor.get(author) ?? new Set<string>())];
  }
}
