import { randomUUID } from "crypto";
import { INTEREST_CATALOG, Interest } from "./interestsInfo";

const MAX_NAME_LENGTH = 40;

export interface ExploreTheme {
  id: string;
  name: string;
  interests: Interest[];
  active: boolean;
  createdAt: string;
}

export type CreateThemeResult = { success: true; theme: ExploreTheme } | { success: false; error: string };
export type UpdateThemeResult = { success: true; theme: ExploreTheme } | { success: false; error: string };

export interface ThemeUpdate {
  name?: unknown;
  interests?: unknown;
  active?: unknown;
}

function isInterest(value: unknown): value is Interest {
  return typeof value === "string" && (INTEREST_CATALOG as readonly string[]).includes(value);
}

function parseInterests(value: unknown): Interest[] | { error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "interests must be a non-empty array" };
  }
  if (!value.every(isInterest)) {
    return { error: `interests must be from: ${INTEREST_CATALOG.join(", ")}` };
  }
  return value;
}

/**
 * Bumble's real "Full control over Explore section content and hashtags"
 * (#182) — turns #99's Explore Mode from a fixed, code-defined catalog
 * (cafes/sports/travel) into an admin-managed one, gated the same
 * admin-key way as #171-181. "Hashtags" here means #79's existing fixed
 * interest-tag catalog (`INTEREST_CATALOG`) — this app has no separate
 * free-text hashtag system, so a theme's content is which of those real
 * tags it's built from, the same "backend-configurable within a fixed
 * catalog" scoping call #79 itself already made, not a fabricated
 * open-ended tagging engine.
 */
export class ExploreThemeStore {
  private themesById = new Map<string, ExploreTheme>();

  create(name: unknown, interests: unknown): CreateThemeResult {
    const nameText = typeof name === "string" ? name.trim() : "";
    if (!nameText) return { success: false, error: "name is required" };
    if (nameText.length > MAX_NAME_LENGTH) return { success: false, error: `name must be ${MAX_NAME_LENGTH} characters or fewer` };
    const parsedInterests = parseInterests(interests);
    if ("error" in parsedInterests) return { success: false, error: parsedInterests.error };

    const theme: ExploreTheme = {
      id: randomUUID(),
      name: nameText,
      interests: parsedInterests,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.themesById.set(theme.id, theme);
    return { success: true, theme };
  }

  update(themeId: string, changes: ThemeUpdate): UpdateThemeResult {
    const theme = this.themesById.get(themeId);
    if (!theme) return { success: false, error: "Theme not found" };

    const next: ExploreTheme = { ...theme };
    if (changes.name !== undefined) {
      const nameText = typeof changes.name === "string" ? changes.name.trim() : "";
      if (!nameText) return { success: false, error: "name is required" };
      if (nameText.length > MAX_NAME_LENGTH) return { success: false, error: `name must be ${MAX_NAME_LENGTH} characters or fewer` };
      next.name = nameText;
    }
    if (changes.interests !== undefined) {
      const parsedInterests = parseInterests(changes.interests);
      if ("error" in parsedInterests) return { success: false, error: parsedInterests.error };
      next.interests = parsedInterests;
    }
    if (changes.active !== undefined) {
      if (typeof changes.active !== "boolean") return { success: false, error: "active must be a boolean" };
      next.active = changes.active;
    }

    this.themesById.set(themeId, next);
    return { success: true, theme: next };
  }

  get(themeId: string): ExploreTheme | undefined {
    return this.themesById.get(themeId);
  }

  /** Every theme, newest first — the admin management view. */
  list(): ExploreTheme[] {
    return [...this.themesById.values()].reverse();
  }

  /** Only active themes — what the real swiper-facing catalog shows. */
  listActive(): ExploreTheme[] {
    return this.list().filter((theme) => theme.active);
  }
}
