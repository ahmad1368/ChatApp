const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const MEDIA_URL = "https://graph.instagram.com/me/media?fields=id,media_type,media_url,permalink&limit=5";

export interface InstagramCredentials {
  clientId: string;
  clientSecret: string;
}

export interface InstagramProfile {
  posts: string[];
}

export type InstagramPostsFetcher = (
  code: string,
  redirectUri: string,
  credentials: InstagramCredentials
) => Promise<InstagramProfile | undefined>;

/**
 * Real fetch: exchanges the authorization code the client obtained from
 * Instagram's OAuth redirect for a short-lived access token (Instagram
 * Basic Display API), then asks the Graph API for the user's 5 latest
 * media items — same "client does the OAuth redirect, server verifies/
 * fetches with the resulting code" shape as spotifyAuth.ts (#77) and
 * googleAuth.ts/facebookAuth.ts (#23-#25).
 */
export const fetchInstagramLatestPosts: InstagramPostsFetcher = async (code, redirectUri, { clientId, clientSecret }) => {
  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }).toString(),
    });
    if (!tokenRes.ok) return undefined;
    const tokenBody = await tokenRes.json();
    const accessToken = tokenBody?.access_token;
    if (typeof accessToken !== "string") return undefined;

    const mediaRes = await fetch(`${MEDIA_URL}&access_token=${encodeURIComponent(accessToken)}`);
    if (!mediaRes.ok) return undefined;
    const mediaBody = await mediaRes.json();
    const items = Array.isArray(mediaBody?.data) ? mediaBody.data : [];
    const posts = items
      .map((item: { permalink?: unknown; media_url?: unknown }) => {
        const permalink = typeof item?.permalink === "string" ? item.permalink : undefined;
        const mediaUrl = typeof item?.media_url === "string" ? item.media_url : undefined;
        return permalink ?? mediaUrl;
      })
      .filter((entry: string | undefined): entry is string => Boolean(entry));

    return { posts };
  } catch {
    return undefined;
  }
};

export class InstagramService {
  constructor(
    private readonly clientId: string | undefined = process.env.INSTAGRAM_CLIENT_ID,
    private readonly clientSecret: string | undefined = process.env.INSTAGRAM_CLIENT_SECRET,
    private readonly fetcher: InstagramPostsFetcher = fetchInstagramLatestPosts
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  async fetchLatestPosts(code: string, redirectUri: string): Promise<InstagramProfile | undefined> {
    if (!this.clientId || !this.clientSecret) return undefined;
    return this.fetcher(code, redirectUri, { clientId: this.clientId, clientSecret: this.clientSecret });
  }
}
