export interface WidgetCounts {
  unreadNotifications: number;
  newLikes: number;
  activeMatches: number;
}

export interface WidgetSummary extends WidgetCounts {
  hasUpdates: boolean;
}

/**
 * Tinder's real "Home screen widget support for iPhone and Android"
 * (#261) — same genuinely platform-specific gap as #193/#194's app-store
 * billing bridges, not a "web equivalent" situation: this repo has no
 * native iOS WidgetKit extension or Android AppWidgetProvider to actually
 * render on a home screen. What's real and platform-agnostic: the small,
 * cheap summary endpoint any such widget's timeline provider would poll
 * on its own refresh schedule, built from this app's actual live data
 * (#159's unread-notification count, #103's pending-likes count, #100's
 * active-match count) rather than fabricated sample data. No web UI here
 * — there's no home screen for a browser tab to add a widget to.
 */
export function buildWidgetSummary(counts: WidgetCounts): WidgetSummary {
  return { ...counts, hasUpdates: counts.unreadNotifications > 0 || counts.newLikes > 0 };
}
