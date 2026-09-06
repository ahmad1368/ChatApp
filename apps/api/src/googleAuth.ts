import { OAuth2Client } from "google-auth-library";

export interface GoogleProfile {
  googleId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

export type GoogleIdTokenVerifier = (idToken: string, clientId: string) => Promise<GoogleProfile | undefined>;

/** Real verification: validates the token's signature against Google's
 * public keys and checks the audience matches our client id. */
export const verifyGoogleIdToken: GoogleIdTokenVerifier = async (idToken, clientId) => {
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub) return undefined;
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.picture,
    };
  } catch {
    return undefined;
  }
};

export class GoogleAuthService {
  constructor(
    private readonly clientId: string | undefined = process.env.GOOGLE_CLIENT_ID,
    private readonly verifier: GoogleIdTokenVerifier = verifyGoogleIdToken
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId);
  }

  async verify(idToken: string): Promise<GoogleProfile | undefined> {
    if (!this.clientId) return undefined;
    return this.verifier(idToken, this.clientId);
  }
}
