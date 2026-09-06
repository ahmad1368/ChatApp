import crypto from "crypto";
import jwt from "jsonwebtoken";
import { AuthTokens, AuthUser } from "@chatapp/shared";
import { GoogleProfile } from "./googleAuth";
import { AppleProfile } from "./appleAuth";
import { FacebookProfile } from "./facebookAuth";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const ACCESS_TOKEN_TTL = "15m";
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

const PHONE_NUMBER_PATTERN = /^\+?[1-9]\d{7,14}$/;

export function normalizePhoneNumber(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return PHONE_NUMBER_PATTERN.test(trimmed) ? trimmed : undefined;
}

interface OtpEntry {
  code: string;
  expiresAt: number;
  attemptsRemaining: number;
  lastSentAt: number;
}

export type RequestOtpResult = { code: string } | { error: "cooldown"; retryAfterMs: number };
export type VerifyOtpResult = { success: true } | { success: false; error: "invalid" | "expired" | "too_many_attempts" };

/**
 * A real deployment sends `code` via an SMS provider (Twilio, etc.) — that
 * needs a real account/credentials this change can't provision, so the
 * route handler logs it server-side instead. Everything around it (expiry,
 * one-time use, attempt limiting, resend cooldown) is real.
 */
export class OtpService {
  private entries = new Map<string, OtpEntry>();

  requestOtp(phoneNumber: string): RequestOtpResult {
    const now = Date.now();
    const existing = this.entries.get(phoneNumber);
    if (existing && now - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
      return { error: "cooldown", retryAfterMs: OTP_RESEND_COOLDOWN_MS - (now - existing.lastSentAt) };
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    this.entries.set(phoneNumber, {
      code,
      expiresAt: now + OTP_TTL_MS,
      attemptsRemaining: OTP_MAX_ATTEMPTS,
      lastSentAt: now,
    });
    return { code };
  }

  verifyOtp(phoneNumber: string, code: string): VerifyOtpResult {
    const entry = this.entries.get(phoneNumber);
    if (!entry) return { success: false, error: "invalid" };

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(phoneNumber);
      return { success: false, error: "expired" };
    }

    if (entry.attemptsRemaining <= 0) {
      this.entries.delete(phoneNumber);
      return { success: false, error: "too_many_attempts" };
    }

    if (entry.code !== code) {
      entry.attemptsRemaining -= 1;
      return { success: false, error: "invalid" };
    }

    this.entries.delete(phoneNumber); // one-time use
    return { success: true };
  }
}

// One store shared by every sign-in method: a user found-or-created by
// phone/Google/Apple keeps the same AuthUser shape, each living in its own
// in-memory map keyed by whichever identifier applies.
export class UserStore {
  private usersByPhone = new Map<string, AuthUser>();
  private usersByGoogleId = new Map<string, AuthUser>();
  private usersByAppleId = new Map<string, AuthUser>();
  private usersByFacebookId = new Map<string, AuthUser>();
  private usersByEmail = new Map<string, AuthUser>();

  findOrCreate(phoneNumber: string): AuthUser {
    const existing = this.usersByPhone.get(phoneNumber);
    if (existing) return existing;

    const user: AuthUser = {
      id: crypto.randomUUID(),
      phoneNumber,
      displayName: `Guest ${phoneNumber.slice(-4)}`,
      createdAt: new Date().toISOString(),
    };
    this.usersByPhone.set(phoneNumber, user);
    return user;
  }

  findOrCreateByGoogle(profile: GoogleProfile): AuthUser {
    const existing = this.usersByGoogleId.get(profile.googleId);
    if (existing) return existing;

    const user: AuthUser = {
      id: crypto.randomUUID(),
      googleId: profile.googleId,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      displayName: profile.name ?? profile.email ?? "Google user",
      createdAt: new Date().toISOString(),
    };
    this.usersByGoogleId.set(profile.googleId, user);
    return user;
  }

  findOrCreateByApple(profile: AppleProfile): AuthUser {
    const existing = this.usersByAppleId.get(profile.appleId);
    if (existing) return existing;

    const user: AuthUser = {
      id: crypto.randomUUID(),
      appleId: profile.appleId,
      email: profile.email,
      displayName: profile.email ?? "Apple user",
      createdAt: new Date().toISOString(),
    };
    this.usersByAppleId.set(profile.appleId, user);
    return user;
  }

  findOrCreateByFacebook(profile: FacebookProfile): AuthUser {
    const existing = this.usersByFacebookId.get(profile.facebookId);
    if (existing) return existing;

    const user: AuthUser = {
      id: crypto.randomUUID(),
      facebookId: profile.facebookId,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      displayName: profile.name ?? profile.email ?? "Facebook user",
      createdAt: new Date().toISOString(),
    };
    this.usersByFacebookId.set(profile.facebookId, user);
    return user;
  }

  // Email-based account recovery (see recovery.ts): a user with no phone
  // access anymore is found-or-created by email, same as every other
  // provider identifier.
  findOrCreateByEmail(email: string): AuthUser {
    const existing = this.usersByEmail.get(email);
    if (existing) return existing;

    const user: AuthUser = {
      id: crypto.randomUUID(),
      email,
      displayName: email.split("@")[0],
      createdAt: new Date().toISOString(),
    };
    this.usersByEmail.set(email, user);
    return user;
  }
}

function loadJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  console.warn("JWT_SECRET not set — generating an ephemeral secret. Sessions won't survive a server restart.");
  return crypto.randomBytes(32).toString("hex");
}

export class TokenService {
  private readonly secret = loadJwtSecret();
  private refreshTokens = new Map<string, string>(); // refresh token -> userId

  issueTokens(userId: string): AuthTokens {
    const accessToken = jwt.sign({ sub: userId }, this.secret, { expiresIn: ACCESS_TOKEN_TTL });
    const refreshToken = crypto.randomUUID();
    this.refreshTokens.set(refreshToken, userId);
    return { accessToken, refreshToken, expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS };
  }

  refresh(refreshToken: string): AuthTokens | undefined {
    const userId = this.refreshTokens.get(refreshToken);
    if (!userId) return undefined;
    this.refreshTokens.delete(refreshToken); // rotate on use
    return this.issueTokens(userId);
  }

  verifyAccessToken(token: string): { userId: string } | undefined {
    try {
      const payload = jwt.verify(token, this.secret);
      if (typeof payload === "object" && typeof payload.sub === "string") {
        return { userId: payload.sub };
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
}
