export const SWIPE_DIRECTIONS = ["like", "pass", "superlike"] as const;
export type SwipeDirection = (typeof SWIPE_DIRECTIONS)[number];

export const DAILY_SUPER_LIKE_LIMIT = 1;

export type RecordSwipeResult = { success: true; matched: boolean } | { success: false; error: string };
export type JoinDiscoveryResult = { success: true } | { success: false; error: string };
export type UndoLastSwipeResult = { success: true; swiped: string } | { success: false; error: string };

export interface SwipeCandidate {
  author: string;
  compatibility: number;
}

export type CompatibilityScorer = (a: string, b: string) => number;

function isSwipeDirection(value: unknown): value is SwipeDirection {
  return typeof value === "string" && (SWIPE_DIRECTIONS as readonly string[]).includes(value);
}

// A "like" the match check should count, whether it's an ordinary like or a
// Super Like — both create a match the moment the other side likes back.
function isLikeOrSuperLike(direction: SwipeDirection | undefined): boolean {
  return direction === "like" || direction === "superlike";
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
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
 *
 * `undoLastSwipe` (#92) is Tinder's real "Rewind" feature: undoes only the
 * single most recent swipe (matching the issue's literal "undo the LAST
 * like or dislike", not a full history you can step back through
 * repeatedly), makes that candidate swipeable again, and revokes the match
 * too if that swipe was the one that created it — real Tinder does the
 * same rather than leaving a "ghost" match neither side actually confirmed
 * anymore. Gated behind Tinder Gold there; this app has no
 * premium/paywall system, so it's free here, same as every other feature
 * in this backlog that's a paid tier upstream.
 *
 * A "superlike" direction (#93) is Tinder's real Super Like: it counts as
 * a like for match purposes (mutual like-or-superlike from both sides
 * matches, same as two ordinary likes), and candidates who superliked this
 * author but haven't been swiped back yet are surfaced first in
 * `getCandidates` — the actual "special attention" the feature name
 * promises, not just a cosmetic swipe-up gesture. Rate-limited to
 * DAILY_SUPER_LIKE_LIMIT per author per UTC day: real Tinder rate-limits
 * this too (1/day free, more on paid tiers we don't model), and an
 * unlimited "make yourself stand out" signal would just be spam.
 *
 * `getCandidates`'s optional `getCompatibility` scorer (#94) is where
 * OkCupid's real percentage-match algorithm plugs in — see
 * interestCompatibility.ts. `SwipeStore` itself stays decoupled from what
 * the score is computed from (interests, in the current caller), same DI
 * seam as the block check.
 */
export class SwipeStore {
  private candidates = new Set<string>();
  private swipesBySwiper = new Map<string, Map<string, SwipeDirection>>();
  private matchesByAuthor = new Map<string, Set<string>>();
  private lastSwipeBySwiper = new Map<string, string>();
  private superLikesUsedToday = new Map<string, { date: string; count: number }>();

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

  getCandidates(
    author: string,
    isBlockedEitherWay: (a: string, b: string) => boolean,
    getCompatibility: CompatibilityScorer = () => 0,
    limit = 10
  ): SwipeCandidate[] {
    const swiped = this.swipesBySwiper.get(author);
    const eligible: string[] = [];
    for (const candidate of this.candidates) {
      if (candidate === author) continue;
      if (swiped?.has(candidate)) continue;
      if (isBlockedEitherWay(author, candidate)) continue;
      eligible.push(candidate);
    }

    // Surface anyone who's already superliked this author first — the
    // "special attention" a Super Like (#93) is actually for. Within that,
    // rank by #94's interest-vector compatibility score, highest first —
    // OkCupid's real percentage-match ordering.
    const superlikedBy = (candidate: string) => this.swipesBySwiper.get(candidate)?.get(author) === "superlike";
    eligible.sort((a, b) => {
      const superlikeDiff = Number(superlikedBy(b)) - Number(superlikedBy(a));
      if (superlikeDiff !== 0) return superlikeDiff;
      return getCompatibility(author, b) - getCompatibility(author, a);
    });

    return eligible.slice(0, limit).map((candidate) => ({ author: candidate, compatibility: getCompatibility(author, candidate) }));
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

    if (direction === "superlike") {
      const usage = this.superLikesUsedToday.get(swiperName);
      const today = todayKey();
      const usedToday = usage?.date === today ? usage.count : 0;
      if (usedToday >= DAILY_SUPER_LIKE_LIMIT) {
        return { success: false, error: "You've used all your Super Likes for today" };
      }
      this.superLikesUsedToday.set(swiperName, { date: today, count: usedToday + 1 });
    }

    swiperMap.set(swipedName, direction);
    this.swipesBySwiper.set(swiperName, swiperMap);
    this.lastSwipeBySwiper.set(swiperName, swipedName);

    let matched = false;
    if (isLikeOrSuperLike(direction) && isLikeOrSuperLike(this.swipesBySwiper.get(swipedName)?.get(swiperName))) {
      matched = true;
      this.recordMatch(swiperName, swipedName);
    }

    return { success: true, matched };
  }

  undoLastSwipe(author: unknown): UndoLastSwipeResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    const swiped = this.lastSwipeBySwiper.get(authorName);
    if (!swiped) {
      return { success: false, error: "Nothing to undo" };
    }

    const undoneDirection = this.swipesBySwiper.get(authorName)?.get(swiped);
    this.swipesBySwiper.get(authorName)?.delete(swiped);
    this.lastSwipeBySwiper.delete(authorName);
    this.revokeMatch(authorName, swiped);

    // Refund the daily Super Like if that's what's being undone, so a
    // rewind doesn't cost the user their one-per-day allowance.
    if (undoneDirection === "superlike") {
      const usage = this.superLikesUsedToday.get(authorName);
      const today = todayKey();
      if (usage?.date === today && usage.count > 0) {
        this.superLikesUsedToday.set(authorName, { date: today, count: usage.count - 1 });
      }
    }

    return { success: true, swiped };
  }

  private recordMatch(a: string, b: string): void {
    const setA = this.matchesByAuthor.get(a) ?? new Set<string>();
    setA.add(b);
    this.matchesByAuthor.set(a, setA);

    const setB = this.matchesByAuthor.get(b) ?? new Set<string>();
    setB.add(a);
    this.matchesByAuthor.set(b, setB);
  }

  private revokeMatch(a: string, b: string): void {
    this.matchesByAuthor.get(a)?.delete(b);
    this.matchesByAuthor.get(b)?.delete(a);
  }

  getMatches(author: string): string[] {
    return [...(this.matchesByAuthor.get(author) ?? new Set<string>())];
  }

  /**
   * Tinder's real "Likes You" (#103): everyone who's already liked or
   * superliked this author but hasn't been swiped back on yet — real
   * Tinder blurs this list behind a paywall; this app has no premium
   * tier (same call as #92's free Rewind), so it's shown in full. Once
   * `author` swipes back either way, that person either becomes a match
   * (visible in getMatches) or drops off this list — never both places
   * at once. Ranked the same way as getCandidates: superlikers first,
   * then by compatibility.
   */
  getLikedBy(author: string, isBlockedEitherWay: (a: string, b: string) => boolean, getCompatibility: CompatibilityScorer = () => 0): SwipeCandidate[] {
    const alreadySwipedByAuthor = this.swipesBySwiper.get(author);
    const likedBy: string[] = [];
    for (const [swiper, swipedMap] of this.swipesBySwiper) {
      if (swiper === author) continue;
      const direction = swipedMap.get(author);
      if (direction !== "like" && direction !== "superlike") continue;
      if (alreadySwipedByAuthor?.has(swiper)) continue;
      if (isBlockedEitherWay(author, swiper)) continue;
      likedBy.push(swiper);
    }

    const superlikedMe = (candidate: string) => this.swipesBySwiper.get(candidate)?.get(author) === "superlike";
    likedBy.sort((a, b) => {
      const superlikeDiff = Number(superlikedMe(b)) - Number(superlikedMe(a));
      if (superlikeDiff !== 0) return superlikeDiff;
      return getCompatibility(author, b) - getCompatibility(author, a);
    });

    return likedBy.map((candidate) => ({ author: candidate, compatibility: getCompatibility(author, candidate) }));
  }

  getSuperLikesRemainingToday(author: string): number {
    const usage = this.superLikesUsedToday.get(author);
    const usedToday = usage?.date === todayKey() ? usage.count : 0;
    return Math.max(0, DAILY_SUPER_LIKE_LIMIT - usedToday);
  }
}
