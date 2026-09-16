const DEFAULT_DURATION_MS = 60 * 60 * 1000;

function toGoogleCalendarUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Match.com's real "Send a date invitation card directly to Google
 * Calendar" (#262) — Google's own documented, no-API-key, no-OAuth
 * "render" template URL (calendar.google.com/calendar/render?action=
 * TEMPLATE&...) rather than a fabricated Calendar API integration this
 * app has no OAuth flow or credentials for. #146's DateInvite only
 * carries a single proposedAt instant, not a duration, so this assumes a
 * disclosed default 1-hour event — the same kind of reasonable, stated
 * assumption #259's match timer makes about elapsed time.
 */
export function buildGoogleCalendarLink(params: { title: string; location: string; proposedAt: string; details?: string }): string {
  const start = new Date(params.proposedAt);
  const end = new Date(start.getTime() + DEFAULT_DURATION_MS);

  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: params.title,
    dates: `${toGoogleCalendarUtc(start)}/${toGoogleCalendarUtc(end)}`,
    location: params.location,
  });
  if (params.details) query.set("details", params.details);

  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}
