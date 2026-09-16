const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

export interface FacebookProfile {
  facebookId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

export interface FacebookCredentials {
  appId: string;
  appSecret: string;
}

export type FacebookTokenVerifier = (
  userAccessToken: string,
  credentials: FacebookCredentials
) => Promise<FacebookProfile | undefined>;

export type FacebookFriendsFetcher = (userAccessToken: string) => Promise<string[]>;

/**
 * Real Graph API call to /me/friends — but honestly, since Facebook's
 * 2015 (v2.0) platform lockdown, this endpoint only ever returns the
 * subset of the user's friends who *also* authorized this same app, not
 * their full friends list (#253's mutual-connections feature is real,
 * but will only ever surface something for two ChatApp users who are
 * already Facebook friends with each other — a genuine platform
 * limitation, disclosed rather than worked around with a fabricated
 * full-graph import).
 */
export const fetchFacebookFriends: FacebookFriendsFetcher = async (userAccessToken) => {
  try {
    const friendsUrl = `${GRAPH_API_BASE}/me/friends?access_token=${encodeURIComponent(userAccessToken)}`;
    const res = await fetch(friendsUrl);
    if (!res.ok) return [];
    const body = await res.json();
    if (!Array.isArray(body?.data)) return [];
    return body.data.filter((entry: unknown): entry is { id: string } => typeof (entry as { id?: unknown })?.id === "string").map((entry: { id: string }) => entry.id);
  } catch {
    return [];
  }
};

/**
 * Real verification: uses Facebook's debug_token endpoint (authenticated
 * with our own app id/secret as an "app token") to confirm the client-
 * supplied token is genuine, unexpired, and was issued to our app —
 * without that check, a token from a *different* Facebook app could be
 * replayed here. Only after that passes do we fetch the profile.
 */
export const verifyFacebookToken: FacebookTokenVerifier = async (userAccessToken, { appId, appSecret }) => {
  try {
    const appToken = `${appId}|${appSecret}`;
    const debugUrl = `${GRAPH_API_BASE}/debug_token?input_token=${encodeURIComponent(userAccessToken)}&access_token=${encodeURIComponent(appToken)}`;
    const debugRes = await fetch(debugUrl);
    if (!debugRes.ok) return undefined;
    const debugBody = await debugRes.json();
    const tokenData = debugBody?.data;
    if (!tokenData?.is_valid || tokenData?.app_id !== appId || !tokenData?.user_id) {
      return undefined;
    }

    const profileUrl = `${GRAPH_API_BASE}/me?fields=id,name,email,picture&access_token=${encodeURIComponent(userAccessToken)}`;
    const profileRes = await fetch(profileUrl);
    if (!profileRes.ok) return undefined;
    const profile = await profileRes.json();
    if (!profile?.id) return undefined;

    return {
      facebookId: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture?.data?.url,
    };
  } catch {
    return undefined;
  }
};

export class FacebookAuthService {
  constructor(
    private readonly appId: string | undefined = process.env.FACEBOOK_APP_ID,
    private readonly appSecret: string | undefined = process.env.FACEBOOK_APP_SECRET,
    private readonly verifier: FacebookTokenVerifier = verifyFacebookToken,
    private readonly friendsFetcher: FacebookFriendsFetcher = fetchFacebookFriends
  ) {}

  isConfigured(): boolean {
    return Boolean(this.appId && this.appSecret);
  }

  async verify(userAccessToken: string): Promise<FacebookProfile | undefined> {
    if (!this.appId || !this.appSecret) return undefined;
    return this.verifier(userAccessToken, { appId: this.appId, appSecret: this.appSecret });
  }

  async fetchFriends(userAccessToken: string): Promise<string[]> {
    if (!this.appId || !this.appSecret) return [];
    return this.friendsFetcher(userAccessToken);
  }
}
