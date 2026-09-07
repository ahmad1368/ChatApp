import { randomUUID } from "crypto";

// Tinder's real "Double Date": a small group, not just a pair — up to a
// handful of friends teaming up together.
export const MIN_SQUAD_SIZE = 2;
export const MAX_SQUAD_SIZE = 4;

export const SQUAD_SWIPE_DIRECTIONS = ["like", "pass"] as const;
export type SquadSwipeDirection = (typeof SQUAD_SWIPE_DIRECTIONS)[number];

export interface Squad {
  id: string;
  members: string[];
}

export type CreateSquadResult = { success: true; squad: Squad } | { success: false; error: string };
export type DisbandSquadResult = { success: true } | { success: false; error: string };
export type JoinSquadDiscoveryResult = { success: true } | { success: false; error: string };
export type RecordSquadSwipeResult =
  | { success: true; matched: boolean; roomId?: string }
  | { success: false; error: string };

export interface GroupMatch {
  squadId: string;
  roomId: string;
}

function isSquadSwipeDirection(value: unknown): value is SquadSwipeDirection {
  return typeof value === "string" && (SQUAD_SWIPE_DIRECTIONS as readonly string[]).includes(value);
}

// Deterministic per unordered pair, so a room is created once and reused
// no matter which squad's swipe completes the mutual like.
function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

/**
 * Match.com's real "Double Date" / Tinder's Double Date (#109): a small
 * group of friends (2-4 people) teams up as one "squad" and swipes on
 * other squads together — a mutual like between two squads opens one
 * shared group chat room for everyone in both squads, reusing this app's
 * existing multi-room chat (any room ID works, same as #10's deep-linked
 * rooms) rather than building a separate group-chat subsystem.
 *
 * Deliberately scoped to the actual group-matching mechanic (create a
 * squad, discover other squads, swipe, match, get a shared room) — no
 * separate group-compatibility scoring algorithm is invented here; that
 * would be fabricating detail beyond what "group matching" literally
 * asks for. One active squad per author at a time, same simplifying
 * assumption #91's SwipeStore makes about one swipe per candidate pair.
 */
export class SquadStore {
  private squadsById = new Map<string, Squad>();
  private squadIdByMember = new Map<string, string>();
  private discoveryPool = new Set<string>();
  private swipesBySquad = new Map<string, Map<string, SquadSwipeDirection>>();
  private groupMatchesBySquad = new Map<string, Map<string, string>>(); // squadId -> (otherSquadId -> roomId)

  createSquad(members: unknown): CreateSquadResult {
    if (!Array.isArray(members)) {
      return { success: false, error: "members must be a list" };
    }
    const memberNames = [...new Set(members.map((m) => (typeof m === "string" ? m.trim() : "")))].filter(Boolean);
    if (memberNames.length !== members.length) {
      return { success: false, error: "members must be distinct, non-empty author names" };
    }
    if (memberNames.length < MIN_SQUAD_SIZE || memberNames.length > MAX_SQUAD_SIZE) {
      return { success: false, error: `a squad must have between ${MIN_SQUAD_SIZE} and ${MAX_SQUAD_SIZE} members` };
    }
    for (const member of memberNames) {
      if (this.squadIdByMember.has(member)) {
        return { success: false, error: `${member} is already in a squad` };
      }
    }

    const squad: Squad = { id: randomUUID(), members: memberNames };
    this.squadsById.set(squad.id, squad);
    for (const member of memberNames) {
      this.squadIdByMember.set(member, squad.id);
    }
    return { success: true, squad };
  }

  getSquad(squadId: string): Squad | null {
    return this.squadsById.get(squadId) ?? null;
  }

  getSquadForAuthor(author: string): Squad | null {
    const squadId = this.squadIdByMember.get(author);
    return squadId ? this.getSquad(squadId) : null;
  }

  disbandSquad(squadId: string, requestingAuthor: string): DisbandSquadResult {
    const squad = this.squadsById.get(squadId);
    if (!squad) {
      return { success: false, error: "Squad not found" };
    }
    if (!squad.members.includes(requestingAuthor)) {
      return { success: false, error: "Only a squad member can disband it" };
    }
    for (const member of squad.members) {
      this.squadIdByMember.delete(member);
    }
    this.squadsById.delete(squadId);
    this.discoveryPool.delete(squadId);
    return { success: true };
  }

  joinDiscovery(squadId: string): JoinSquadDiscoveryResult {
    if (!this.squadsById.has(squadId)) {
      return { success: false, error: "Squad not found" };
    }
    this.discoveryPool.add(squadId);
    return { success: true };
  }

  leaveDiscovery(squadId: string): void {
    this.discoveryPool.delete(squadId);
  }

  getCandidates(squadId: string, limit = 10): string[] {
    const swiped = this.swipesBySquad.get(squadId);
    const candidates: string[] = [];
    for (const candidateId of this.discoveryPool) {
      if (candidateId === squadId) continue;
      if (swiped?.has(candidateId)) continue;
      candidates.push(candidateId);
      if (candidates.length >= limit) break;
    }
    return candidates;
  }

  recordSwipe(swiperSquadId: unknown, swipedSquadId: unknown, direction: unknown): RecordSquadSwipeResult {
    const swiper = typeof swiperSquadId === "string" ? swiperSquadId.trim() : "";
    const swiped = typeof swipedSquadId === "string" ? swipedSquadId.trim() : "";
    if (!swiper || !swiped) {
      return { success: false, error: "swiperSquadId and swipedSquadId are required" };
    }
    if (swiper === swiped) {
      return { success: false, error: "A squad cannot swipe on itself" };
    }
    if (!this.squadsById.has(swiper) || !this.squadsById.has(swiped)) {
      return { success: false, error: "Squad not found" };
    }
    if (!isSquadSwipeDirection(direction)) {
      return { success: false, error: `direction must be one of: ${SQUAD_SWIPE_DIRECTIONS.join(", ")}` };
    }

    const swiperMap = this.swipesBySquad.get(swiper) ?? new Map<string, SquadSwipeDirection>();
    if (swiperMap.has(swiped)) {
      return { success: false, error: "Already swiped on this squad" };
    }
    swiperMap.set(swiped, direction);
    this.swipesBySquad.set(swiper, swiperMap);

    const otherDirection = this.swipesBySquad.get(swiped)?.get(swiper);
    if (direction === "like" && otherDirection === "like") {
      const roomId = this.recordGroupMatch(swiper, swiped);
      return { success: true, matched: true, roomId };
    }
    return { success: true, matched: false };
  }

  private recordGroupMatch(a: string, b: string): string {
    const existing = this.groupMatchesBySquad.get(a)?.get(b);
    if (existing) return existing;

    const roomId = `squad-${pairKey(a, b)}`;
    const matchesA = this.groupMatchesBySquad.get(a) ?? new Map<string, string>();
    matchesA.set(b, roomId);
    this.groupMatchesBySquad.set(a, matchesA);

    const matchesB = this.groupMatchesBySquad.get(b) ?? new Map<string, string>();
    matchesB.set(a, roomId);
    this.groupMatchesBySquad.set(b, matchesB);

    return roomId;
  }

  getGroupMatches(squadId: string): GroupMatch[] {
    const matches = this.groupMatchesBySquad.get(squadId);
    if (!matches) return [];
    return [...matches.entries()].map(([otherSquadId, roomId]) => ({ squadId: otherSquadId, roomId }));
  }
}
