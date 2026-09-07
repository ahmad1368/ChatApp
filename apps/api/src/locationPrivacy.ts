export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PassportLocation {
  cityName: string;
  coordinates: Coordinates;
}

export type SetPassportLocationResult =
  | { success: true; location: PassportLocation }
  | { success: false; error: string };

const EARTH_RADIUS_KM = 6371;
export const DEFAULT_PRECISION_KM = 5;
export const MAX_CITY_NAME_LENGTH = 80;
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
 *
 * Tinder's real Passport (#102) lets a user manually set their discovery
 * location to a different city, overriding their real GPS position until
 * they turn it off — distinct from #84's TravelModeInfo, which is only a
 * cosmetic "I'm temporarily somewhere else" profile badge and never
 * changes what location the app actually treats the user as being at.
 * `getEffectiveLocation()` is that real override: it returns the active
 * Passport location when set, falling back to the real GPS location
 * otherwise — the one method the rest of the app (discovery, search
 * radius) should read instead of `getApproximateLocation()` directly, so
 * Passport mode actually takes effect rather than being a label with no
 * behavior behind it.
 */
export class LocationStore {
  private exactByAuthor = new Map<string, Coordinates>();
  private passportByAuthor = new Map<string, PassportLocation>();

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

  setPassportLocation(author: unknown, cityName: unknown, coordinates: unknown): SetPassportLocationResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }

    const cityNameValue = typeof cityName === "string" ? cityName.trim() : "";
    if (!cityNameValue) {
      return { success: false, error: "cityName is required" };
    }
    if (cityNameValue.length > MAX_CITY_NAME_LENGTH) {
      return { success: false, error: `cityName must be ${MAX_CITY_NAME_LENGTH} characters or fewer` };
    }

    if (!isValidCoordinates(coordinates)) {
      return { success: false, error: "lat/lng must be numbers within valid ranges" };
    }

    const location: PassportLocation = { cityName: cityNameValue, coordinates };
    this.passportByAuthor.set(authorName, location);
    return { success: true, location };
  }

  clearPassportLocation(author: string): void {
    this.passportByAuthor.delete(author);
  }

  isPassportActive(author: string): boolean {
    return this.passportByAuthor.has(author);
  }

  getPassportCityName(author: string): string | null {
    return this.passportByAuthor.get(author)?.cityName ?? null;
  }

  getEffectiveLocation(author: string, precisionKm: number = DEFAULT_PRECISION_KM): Coordinates | null {
    const passport = this.passportByAuthor.get(author);
    if (passport) {
      return approximateLocation(passport.coordinates, precisionKm);
    }
    return this.getApproximateLocation(author, precisionKm);
  }
}
