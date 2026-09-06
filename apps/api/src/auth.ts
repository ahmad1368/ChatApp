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

/**
 * A friendly "Chrome on Windows"-style label for the active-sessions list
 * (#60) — the same heuristic parsing this codebase already uses for other
 * first-pass detectors (contactInfoDetector.ts, scamDetector.ts), not a
 * full UA-database lookup.
 */
export function describeUserAgent(userAgent: string | undefined): string {
  if (!userAgent) return "Unknown device";

  let browser = "Unknown browser";
  if (/Edg\//.test(userAgent)) browser = "Edge";
  else if (/Chrome\//.test(userAgent)) browser = "Chrome";
  else if (/Firefox\//.test(userAgent)) browser = "Firefox";
  else if (/Safari\//.test(userAgent)) browser = "Safari";

  // iPhone/iPad checked ahead of "Mac OS X": real iOS user agents contain
  // "like Mac OS X" as part of their string, so checking that first would
  // misidentify every iPhone as a Mac.
  let os = "Unknown OS";
  if (/iPhone|iPad/.test(userAgent)) os = "iOS";
  else if (/Android/.test(userAgent)) os = "Android";
  else if (/Windows/.test(userAgent)) os = "Windows";
  else if (/Mac OS X/.test(userAgent)) os = "macOS";
  else if (/Linux/.test(userAgent)) os = "Linux";

  const isMobile = /Mobile|Android|iPhone/.test(userAgent);
  return `${browser} on ${os}${isMobile ? " (mobile)" : ""}`;
}

function loadJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  console.warn("JWT_SECRET not set — generating an ephemeral secret. Sessions won't survive a server restart.");
  return crypto.randomBytes(32).toString("hex");
}

export interface SessionInfo {
  id: string;
  userId: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string;
}

interface StoredSession extends SessionInfo {
  refreshToken: string;
}

/**
 * A "session" is one sign-in — it survives every access-token refresh
 * (#39's refresh flow rotates the refresh token value but keeps the same
 * session record, updating lastUsedAt) so the sessions list reflects real
 * logins, not every 15-minute token renewal. See #60.
 */
export class TokenService {
  private readonly secret = loadJwtSecret();
  private refreshTokenToSessionId = new Map<string, string>();
  private sessionsById = new Map<string, StoredSession>();

  issueTokens(userId: string, deviceLabel = "Unknown device"): AuthTokens {
    const sessionId = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();
    const now = new Date().toISOString();
    this.sessionsById.set(sessionId, { id: sessionId, userId, deviceLabel, createdAt: now, lastUsedAt: now, refreshToken });
    this.refreshTokenToSessionId.set(refreshToken, sessionId);

    const accessToken = jwt.sign({ sub: userId, sid: sessionId }, this.secret, { expiresIn: ACCESS_TOKEN_TTL });
    return { accessToken, refreshToken, expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS };
  }

  refresh(refreshToken: string): AuthTokens | undefined {
    const sessionId = this.refreshTokenToSessionId.get(refreshToken);
    const session = sessionId ? this.sessionsById.get(sessionId) : undefined;
    if (!sessionId || !session) return undefined;

    this.refreshTokenToSessionId.delete(refreshToken); // rotate on use
    const newRefreshToken = crypto.randomUUID();
    session.refreshToken = newRefreshToken;
    session.lastUsedAt = new Date().toISOString();
    this.refreshTokenToSessionId.set(newRefreshToken, sessionId);

    const accessToken = jwt.sign({ sub: session.userId, sid: sessionId }, this.secret, { expiresIn: ACCESS_TOKEN_TTL });
    return { accessToken, refreshToken: newRefreshToken, expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS };
  }

  verifyAccessToken(token: string): { userId: string; sessionId?: string } | undefined {
    try {
      const payload = jwt.verify(token, this.secret);
      if (typeof payload === "object" && typeof payload.sub === "string") {
        return { userId: payload.sub, sessionId: typeof payload.sid === "string" ? payload.sid : undefined };
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  listSessions(userId: string): SessionInfo[] {
    return Array.from(this.sessionsById.values())
      .filter((session) => session.userId === userId)
      .map(({ refreshToken, ...info }) => info)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  // Invalidates that device's refresh token, so it can't silently renew past
  // its current 15-minute access token — there's no server-side revocation
  // list for already-issued JWTs, so a revoked device stays usable for at
  // most the remainder of that access token's lifetime, same trade-off as
  // most JWT-based session systems.
  revokeSession(userId: string, sessionId: string): boolean {
    const session = this.sessionsById.get(sessionId);
    if (!session || session.userId !== userId) return false;
    this.refreshTokenToSessionId.delete(session.refreshToken);
    this.sessionsById.delete(sessionId);
    return true;
  }

  /** "Log out of other devices" — revokes every session except the caller's own. */
  revokeOtherSessions(userId: string, currentSessionId: string): number {
    const others = Array.from(this.sessionsById.values()).filter(
      (session) => session.userId === userId && session.id !== currentSessionId
    );
    for (const session of others) {
      this.refreshTokenToSessionId.delete(session.refreshToken);
      this.sessionsById.delete(session.id);
    }
    return others.length;
  }
}
