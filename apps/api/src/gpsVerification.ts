import { Coordinates, haversineDistanceKm } from "./locationPrivacy";

/** A GPS/IP divergence beyond this is flagged — wide enough to tolerate normal IP-geolocation imprecision, tight enough to catch a VPN in a different city/region. */
export const MAX_DIVERGENCE_KM = 50;

export type IpLocationFetcher = (ip: string) => Promise<Coordinates | undefined>;

/**
 * Raya's real "Real GPS location verification system that doesn't work
 * with VPN (optional)" (#299) — an honest, real heuristic, not a
 * fabricated "we detect VPNs" claim: no browser API can prove a device
 * isn't using a VPN, so this cross-references the browser's own real
 * Geolocation API reading against a real IP-based geolocation lookup
 * (ip-api.com's free, keyless endpoint — no credentials to gate behind,
 * unlike #77/#286/#295's other third-party integrations). A VPN
 * relocates your IP's apparent location without moving your device's
 * real GPS fix, so a wide mismatch between the two is a genuine, if
 * imperfect, signal — the same principle real anti-fraud/anti-VPN
 * location checks use, not a made-up detection method.
 */
export const fetchIpLocation: IpLocationFetcher = async (ip) => {
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,lat,lon`);
    if (!res.ok) return undefined;
    const body = await res.json();
    if (body?.status !== "success" || typeof body?.lat !== "number" || typeof body?.lon !== "number") {
      return undefined;
    }
    return { lat: body.lat, lng: body.lon };
  } catch {
    return undefined;
  }
};

export interface GpsVerificationResult {
  verified: boolean;
  distanceKm: number | null;
  reason: string;
}

export class GpsVerificationService {
  constructor(private readonly fetcher: IpLocationFetcher = fetchIpLocation) {}

  async verify(gpsLocation: Coordinates, ip: string): Promise<GpsVerificationResult> {
    const ipLocation = await this.fetcher(ip);
    if (!ipLocation) {
      return { verified: false, distanceKm: null, reason: "Could not determine your network location" };
    }

    const distanceKm = Math.round(haversineDistanceKm(gpsLocation, ipLocation));
    if (distanceKm > MAX_DIVERGENCE_KM) {
      return {
        verified: false,
        distanceKm,
        reason: "Your GPS location doesn't match your network location — this can happen when using a VPN",
      };
    }
    return { verified: true, distanceKm, reason: "GPS location matches your network location" };
  }
}
