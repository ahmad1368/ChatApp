import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  Uint8Array_,
  WebAuthnCredential,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";

const RP_NAME = "ChatApp";
const APP_LOCK_RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const APP_LOCK_ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

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

export type OptionsResult<T> = { success: true; options: T } | { success: false; error: string };
export type VerifyResult = { success: true } | { success: false; error: string };

/**
 * Re-authentication with biometrics for the app-lock screen: WebAuthn
 * platform authenticators (Touch ID / Windows Hello / Android fingerprint
 * via Chrome) are the real, working web equivalent of native biometric
 * re-auth — not a native-only gap like screenshot blocking (#44).
 * `authenticatorAttachment: "platform"` and `userVerification: "required"`
 * force an actual biometric/PIN check rather than accepting a roaming
 * security key. Distinct from WebAuthnService above (which re-authenticates
 * a real account, by userId, for login) — this is keyed by the ephemeral
 * chat `author` identity, matching the rest of chat's un-unified
 * author-keyed safety stores (Report/Block/SOS). Its own dependency-free
 * safety path, same as those.
 */
export class WebAuthnStore {
  private credentialByAuthor = new Map<string, WebAuthnCredential>();
  private registrationChallengeByAuthor = new Map<string, string>();
  private authenticationChallengeByAuthor = new Map<string, string>();

  isRegistered(author: string): boolean {
    return this.credentialByAuthor.has(author?.trim());
  }

  async createRegistrationOptions(author: unknown): Promise<OptionsResult<PublicKeyCredentialCreationOptionsJSON>> {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };

    const existing = this.credentialByAuthor.get(authorName);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: APP_LOCK_RP_ID,
      userName: authorName,
      attestationType: "none",
      excludeCredentials: existing ? [{ id: existing.id, transports: existing.transports }] : [],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
    });
    this.registrationChallengeByAuthor.set(authorName, options.challenge);
    return { success: true, options };
  }

  async verifyRegistration(author: unknown, response: unknown): Promise<VerifyResult> {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };

    const expectedChallenge = this.registrationChallengeByAuthor.get(authorName);
    if (!expectedChallenge) return { success: false, error: "No pending registration for this author" };

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: response as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: APP_LOCK_ORIGIN,
        expectedRPID: APP_LOCK_RP_ID,
        requireUserVerification: true,
      });
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Registration verification failed" };
    }

    this.registrationChallengeByAuthor.delete(authorName);
    if (!verification.verified || !verification.registrationInfo) {
      return { success: false, error: "Registration could not be verified" };
    }

    this.credentialByAuthor.set(authorName, verification.registrationInfo.credential);
    return { success: true };
  }

  async createAuthenticationOptions(author: unknown): Promise<OptionsResult<PublicKeyCredentialRequestOptionsJSON>> {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };

    const credential = this.credentialByAuthor.get(authorName);
    if (!credential) return { success: false, error: "No biometric credential registered for this author" };

    const options = await generateAuthenticationOptions({
      rpID: APP_LOCK_RP_ID,
      userVerification: "required",
      allowCredentials: [{ id: credential.id, transports: credential.transports }],
    });
    this.authenticationChallengeByAuthor.set(authorName, options.challenge);
    return { success: true, options };
  }

  async verifyAuthentication(author: unknown, response: unknown): Promise<VerifyResult> {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };

    const expectedChallenge = this.authenticationChallengeByAuthor.get(authorName);
    if (!expectedChallenge) return { success: false, error: "No pending authentication for this author" };

    const credential = this.credentialByAuthor.get(authorName);
    if (!credential) return { success: false, error: "No biometric credential registered for this author" };

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: response as AuthenticationResponseJSON,
        expectedChallenge,
        expectedOrigin: APP_LOCK_ORIGIN,
        expectedRPID: APP_LOCK_RP_ID,
        credential,
        requireUserVerification: true,
      });
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Authentication verification failed" };
    }

    this.authenticationChallengeByAuthor.delete(authorName);
    if (!verification.verified) {
      return { success: false, error: "Authentication could not be verified" };
    }

    credential.counter = verification.authenticationInfo.newCounter;
    return { success: true };
  }
}
