import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from "@simplewebauthn/server";

const RP_NAME = "ChatApp";
const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export type OptionsResult<T> = { success: true; options: T } | { success: false; error: string };
export type VerifyResult = { success: true } | { success: false; error: string };

/**
 * Re-authentication with biometrics: WebAuthn platform authenticators (Touch
 * ID / Windows Hello / Android fingerprint via Chrome) are the real, working
 * web equivalent of native biometric re-auth — not a native-only gap like
 * screenshot blocking (#44). `authenticatorAttachment: "platform"` and
 * `userVerification: "required"` force an actual biometric/PIN check rather
 * than accepting a roaming security key. Its own dependency-free safety path,
 * same as Report/Block/SOS.
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
      rpID: RP_ID,
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
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
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
      rpID: RP_ID,
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
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
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
