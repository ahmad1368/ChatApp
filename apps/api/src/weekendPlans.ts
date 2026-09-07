export const MAX_SELECTED_WEEKEND_PLANS = 5;

// A representative fixed catalog of Hinge-style ready-made weekend-plan
// tags rather than the fully schema-driven, backend-configurable system
// the issue's implementation guide describes — same scoping call as #79's
// interest tags and #73's languages.
export const WEEKEND_PLAN_CATALOG = [
  "brunch",
  "hiking",
  "farmers market",
  "movie night",
  "live music",
  "beach day",
  "road trip",
  "game night",
  "trying a new restaurant",
  "sleeping in",
  "gym session",
  "art gallery",
] as const;
export type WeekendPlan = (typeof WEEKEND_PLAN_CATALOG)[number];

export interface WeekendPlansInfo {
  weekendPlans: WeekendPlan[];
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#79's other profile-detail hide flags.
  hideWeekendPlans: boolean;
}

export type UpdateWeekendPlansResult =
  | { success: true; weekendPlansInfo: WeekendPlansInfo }
  | { success: false; error: string };

function isWeekendPlan(value: unknown): value is WeekendPlan {
  return typeof value === "string" && (WEEKEND_PLAN_CATALOG as readonly string[]).includes(value);
}

const EMPTY_WEEKEND_PLANS_INFO: WeekendPlansInfo = { weekendPlans: [], hideWeekendPlans: false };

/**
 * Editable-anytime weekend-plan tags (#119) — Tinder/Hinge-style "what are
 * you up to this weekend" prompt, same one-value-per-author, replace-on-
 * update, fixed-catalog multi-select shape as #79's interest tags. Kept as
 * its own store rather than folded into InterestsInfoStore: weekend plans
 * are a time-scoped, recurring-answer prompt (what you're doing *this*
 * weekend), not a standing lifestyle interest, so they get their own
 * catalog and their own matching surface (weekendPlanMatch.ts).
 */
export class WeekendPlansStore {
  private infoByAuthor = new Map<string, WeekendPlansInfo>();

  update(author: unknown, weekendPlans: unknown, hideWeekendPlans: unknown): UpdateWeekendPlansResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!Array.isArray(weekendPlans)) {
      return { success: false, error: "weekendPlans must be a list" };
    }
    if (weekendPlans.length > MAX_SELECTED_WEEKEND_PLANS) {
      return { success: false, error: `Choose at most ${MAX_SELECTED_WEEKEND_PLANS} weekend plans` };
    }

    const seen = new Set<WeekendPlan>();
    for (const entry of weekendPlans) {
      if (!isWeekendPlan(entry)) {
        return { success: false, error: "Invalid weekend plan selected" };
      }
      if (seen.has(entry)) {
        return { success: false, error: "Each weekend plan can only be selected once" };
      }
      seen.add(entry);
    }

    const weekendPlansInfo: WeekendPlansInfo = { weekendPlans: [...seen], hideWeekendPlans: hideWeekendPlans === true };
    this.infoByAuthor.set(authorName, weekendPlansInfo);
    return { success: true, weekendPlansInfo };
  }

  get(author: string): WeekendPlansInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_WEEKEND_PLANS_INFO;
  }
}
