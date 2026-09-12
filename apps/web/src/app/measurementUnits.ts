export type MeasurementSystem = "metric" | "imperial";

// Tinder's real "Set measurement units (cm/inch, km/miles)" (#163) —
// height is the only measurement this app actually surfaces to users
// (see apps/api/src/measurementUnits.ts's doc comment for why distance
// isn't in scope here), so these conversions round-trip cm as the
// canonical stored unit while letting an imperial viewer read and enter
// feet/inches.
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  // Rounding inches up to 12 (e.g. 5'12") should carry into an extra foot.
  return inches === 12 ? { feet: feet + 1, inches: 0 } : { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54);
}

export function formatHeightCm(cm: number, system: MeasurementSystem): string {
  if (system === "metric") return `${cm} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}'${inches}"`;
}
