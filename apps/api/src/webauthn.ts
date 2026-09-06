import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON, AuthenticationResponseJSON, Uint8Array_ } from "@simplewebauthn/server";

const RP_NAME = "ChatApp";

export interface StoredCredential {
  credentialId: string;
  publicKey: Uint8Array_;
  counter: number;
}

export interface WebAuthnConfig {
  rpId: string;
  origin: string;
}

/**
 * WebAuthn is the actual web-platform mechanism behind "Face ID and
 * fingerprint" login: the browser talks to the OS's platform authenticator
 * (Touch ID, Windows Hello, Android fingerprint) and this service only ever
 * sees a public key and signed challenges — no biometric data reaches the
 * server, by design of the standard.
 */
export class WebAuthnService {
  private credentialsByUserId = new Map<string, StoredCredential[]>();
  private challengesByUserId = new Map<string, string>();

  constructor(private readonly config: WebAuthnConfig) {}

  async generateRegistrationOptions(userId: string, username: string) {
    const existing = this.credentialsByUserId.get(userId) ?? [];
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: this.config.rpId,
      userName: username,
      attestationType: "none",
      excludeCredentials: existing.map((cred) => ({ id: cred.credentialId })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
    this.challengesByUserId.set(userId, options.challenge);
    return options;
  }

  async verifyRegistration(userId: string, response: RegistrationResponseJSON): Promise<boolean> {
    const expectedChallenge = this.challengesByUserId.get(userId);
    if (!expectedChallenge) return false;

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpId,
      });
    } catch {
      return false;
    }

    this.challengesByUserId.delete(userId);
    if (!verification.verified || !verification.registrationInfo) return false;

    const { credential } = verification.registrationInfo;
    const existing = this.credentialsByUserId.get(userId) ?? [];
    existing.push({ credentialId: credential.id, publicKey: credential.publicKey, counter: credential.counter });
    this.credentialsByUserId.set(userId, existing);
    return true;
  }

  async generateAuthenticationOptions(userId: string) {
    const existing = this.credentialsByUserId.get(userId) ?? [];
    if (existing.length === 0) return undefined;

    const options = await generateAuthenticationOptions({
      rpID: this.config.rpId,
      userVerification: "preferred",
      allowCredentials: existing.map((cred) => ({ id: cred.credentialId })),
    });
    this.challengesByUserId.set(userId, options.challenge);
    return options;
  }

  async verifyAuthentication(userId: string, response: AuthenticationResponseJSON): Promise<boolean> {
    const expectedChallenge = this.challengesByUserId.get(userId);
    const credentials = this.credentialsByUserId.get(userId) ?? [];
    const matching = credentials.find((c) => c.credentialId === response.id);
    if (!expectedChallenge || !matching) return false;

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpId,
        credential: { id: matching.credentialId, publicKey: matching.publicKey, counter: matching.counter },
      });
    } catch {
      return false;
    }

    this.challengesByUserId.delete(userId);
    if (!verification.verified) return false;

    // Reject a replayed/cloned authenticator: a valid device's counter only
    // ever goes up.
    matching.counter = verification.authenticationInfo.newCounter;
    return true;
  }

  hasCredentials(userId: string): boolean {
    return (this.credentialsByUserId.get(userId)?.length ?? 0) > 0;
  }
}
