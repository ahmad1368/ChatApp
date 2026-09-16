export interface GpsVerificationRecord {
  verified: boolean;
  distanceKm: number | null;
  verifiedAt: string | null;
}

const EMPTY_RECORD: GpsVerificationRecord = { verified: false, distanceKm: null, verifiedAt: null };

/** Per-author record of #299's optional real GPS-vs-network-location check — see gpsVerification.ts. */
export class GpsVerificationStore {
  private recordByAuthor = new Map<string, GpsVerificationRecord>();

  get(author: string): GpsVerificationRecord {
    return this.recordByAuthor.get(author?.trim()) ?? EMPTY_RECORD;
  }

  record(author: string, verified: boolean, distanceKm: number | null): GpsVerificationRecord {
    const record: GpsVerificationRecord = { verified, distanceKm, verifiedAt: new Date().toISOString() };
    this.recordByAuthor.set(author, record);
    return record;
  }

  hasVerifiedBadge(author: string): boolean {
    return this.get(author).verified;
  }
}
