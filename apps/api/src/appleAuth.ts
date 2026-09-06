import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URI = "https://appleid.apple.com/auth/keys";

export interface AppleProfile {
  appleId: string;
  email?: string;
}

export type AppleIdTokenVerifier = (idToken: string, clientId: string) => Promise<AppleProfile | undefined>;

const jwks = jwksClient({ jwksUri: APPLE_JWKS_URI, cache: true });

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(kid, (err, key) => {
      if (err || !key) {
        reject(err ?? new Error("No signing key found"));
        return;
      }
      resolve(key.getPublicKey());
    });
  });
}

/** Real verification: fetches Apple's current public keys (JWKS), matches
 * the token's `kid`, and validates signature/issuer/audience/expiry. */
export const verifyAppleIdToken: AppleIdTokenVerifier = async (idToken, clientId) => {
  try {
    const decoded = jwt.decode(idToken, { complete: true });
    const kid = decoded && typeof decoded === "object" ? decoded.header.kid : undefined;
    if (!kid) return undefined;

    const publicKey = await getSigningKey(kid);
    const payload = jwt.verify(idToken, publicKey, {
      algorithms: ["RS256"],
      issuer: APPLE_ISSUER,
      audience: clientId,
    });

    if (typeof payload !== "object" || typeof payload.sub !== "string") return undefined;
    return { appleId: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined };
  } catch {
    return undefined;
  }
};

export class AppleAuthService {
  constructor(
    private readonly clientId: string | undefined = process.env.APPLE_SERVICES_ID,
    private readonly verifier: AppleIdTokenVerifier = verifyAppleIdToken
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId);
  }

  async verify(idToken: string): Promise<AppleProfile | undefined> {
    if (!this.clientId) return undefined;
    return this.verifier(idToken, this.clientId);
  }
}
