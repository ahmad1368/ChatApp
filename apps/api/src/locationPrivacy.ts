export interface Coordinates {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
export const DEFAULT_PRECISION_KM = 5;
const KM_PER_DEGREE_LAT = 111;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function isValidCoordinates(value: unknown): value is Coordinates {
  if (typeof value !== "object" || value === null) return false;
  const { lat, lng } = value as Coordinates;
  return typeof lat === "number" && lat >= -90 && lat <= 90 && typeof lng === "number" && lng >= -180 && lng <= 180;
}

export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Hides an exact location by snapping it to a fixed-size grid cell instead
 * of a fresh random jitter: the same exact point always snaps to the same
 * cell, so repeated lookups can't be averaged together to triangulate the
 * real position (a risk with re-randomized jitter).
 */
export function approximateLocation(exact: Coordinates, precisionKm: number = DEFAULT_PRECISION_KM): Coordinates {
  const cellSizeLatDeg = precisionKm / KM_PER_DEGREE_LAT;
  const cosLat = Math.max(Math.cos(toRadians(exact.lat)), 0.01);
  const cellSizeLngDeg = precisionKm / (KM_PER_DEGREE_LAT * cosLat);

  const snappedLat = Math.round(exact.lat / cellSizeLatDeg) * cellSizeLatDeg;
  const snappedLng = Math.round(exact.lng / cellSizeLngDeg) * cellSizeLngDeg;

  return { lat: Number(snappedLat.toFixed(4)), lng: Number(snappedLng.toFixed(4)) };
}

/**
 * In-memory store of exact locations, keyed by author. Exact coordinates
 * never leave this module — every read goes through approximateLocation().
 */
export class LocationStore {
  private exactByAuthor = new Map<string, Coordinates>();

  setLocation(author: string, exact: Coordinates): void {
    this.exactByAuthor.set(author, exact);
  }

  getApproximateLocation(author: string, precisionKm: number = DEFAULT_PRECISION_KM): Coordinates | null {
    const exact = this.exactByAuthor.get(author);
    if (!exact) return null;
    return approximateLocation(exact, precisionKm);
  }

  hasLocation(author: string): boolean {
    return this.exactByAuthor.has(author);
  }
}
