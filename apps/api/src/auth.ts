import crypto from "crypto";
import jwt from "jsonwebtoken";
import { AuthTokens, AuthUser } from "@chatapp/shared";
import { GoogleProfile } from "./googleAuth";

export class UserStore {
  private usersByGoogleId = new Map<string, AuthUser>();

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
}

const ACCESS_TOKEN_TTL = "15m";
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

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
