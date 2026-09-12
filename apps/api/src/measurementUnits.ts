export const MEASUREMENT_SYSTEMS = ["metric", "imperial"] as const;
export type MeasurementSystem = (typeof MEASUREMENT_SYSTEMS)[number];

const DEFAULT_SYSTEM: MeasurementSystem = "metric";

export type UpdateMeasurementUnitsResult =
  | { success: true; system: MeasurementSystem }
  | { success: false; error: string };

function isMeasurementSystem(value: unknown): value is MeasurementSystem {
  return typeof value === "string" && (MEASUREMENT_SYSTEMS as readonly string[]).includes(value);
}

/**
 * Tinder's real "Set measurement units (cm/inch, km/miles)" (#163). Every
 * measurement this app actually stores and shows a user (height, from
 * #67's heightInfo.ts) stays in its canonical unit (cm) server-side —
 * this is purely a per-viewer display preference, converted client-side
 * (see apps/web/src/app/measurementUnits.ts) the same way #145's
 * translation stays server-authoritative while display formatting is a
 * client concern. Distance (km/miles) has no user-facing display surface
 * in this app yet (crossedPaths.ts's haversineDistanceKm is an internal
 * threshold check, never shown to a user) — scoped to height, the one
 * measurement this app genuinely surfaces, rather than adding a
 * distance-away UI this feature wasn't asked to build.
 */
export class MeasurementUnitsStore {
  private systemByAuthor = new Map<string, MeasurementSystem>();

  get(author: string): MeasurementSystem {
    return this.systemByAuthor.get(author) ?? DEFAULT_SYSTEM;
  }

  update(author: unknown, system: unknown): UpdateMeasurementUnitsResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!isMeasurementSystem(system)) {
      return { success: false, error: `system must be one of: ${MEASUREMENT_SYSTEMS.join(", ")}` };
    }

    this.systemByAuthor.set(authorName, system);
    return { success: true, system };
  }
}
