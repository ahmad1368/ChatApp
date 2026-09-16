export interface FacebookConnectInfo {
  connected: boolean;
  friendIds: string[];
  hideFacebookFriends: boolean;
}

const EMPTY_FACEBOOK_CONNECT_INFO: FacebookConnectInfo = { connected: false, friendIds: [], hideFacebookFriends: false };

/**
 * Tinder's real "Show Facebook mutual connections if the account is
 * linked" (#253) — per-author connection state, same one-connection-per-
 * author, replace-on-reconnect shape as #77's SpotifyInfoStore, but
 * storing the real friend-id list #24's FacebookAuthService.fetchFriends()
 * returns via the Graph API's /me/friends (honestly, only ever the
 * subset of friends who've also authorized this app — see
 * facebookAuth.ts's doc comment). Distinct from #114's ContactsGraphStore,
 * which reimagines this same "mutual friends" signal via uploaded phone
 * contacts specifically *because* this app had no Facebook Graph API
 * integration wired up for it yet — this is the real thing, not a
 * duplicate of that workaround.
 */
export class FacebookConnectStore {
  private infoByAuthor = new Map<string, FacebookConnectInfo>();

  connect(author: string, friendIds: string[]): FacebookConnectInfo {
    const existing = this.infoByAuthor.get(author);
    const info: FacebookConnectInfo = { connected: true, friendIds, hideFacebookFriends: existing?.hideFacebookFriends ?? false };
    this.infoByAuthor.set(author, info);
    return info;
  }

  disconnect(author: string): FacebookConnectInfo {
    const existing = this.infoByAuthor.get(author);
    const info: FacebookConnectInfo = { connected: false, friendIds: [], hideFacebookFriends: existing?.hideFacebookFriends ?? false };
    this.infoByAuthor.set(author, info);
    return info;
  }

  setHideFacebookFriends(author: string, hideFacebookFriends: boolean): FacebookConnectInfo {
    const existing = this.infoByAuthor.get(author) ?? EMPTY_FACEBOOK_CONNECT_INFO;
    const info: FacebookConnectInfo = { ...existing, hideFacebookFriends };
    this.infoByAuthor.set(author, info);
    return info;
  }

  get(author: string): FacebookConnectInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_FACEBOOK_CONNECT_INFO;
  }

  /** Count of Facebook friend ids appearing in both authors' connected friend lists — 0 if either isn't connected, or either hid this. */
  getMutualFriendCount(a: string, b: string): number {
    const infoA = this.get(a);
    const infoB = this.get(b);
    if (!infoA.connected || !infoB.connected || infoA.hideFacebookFriends || infoB.hideFacebookFriends) return 0;
    const friendsB = new Set(infoB.friendIds);
    return infoA.friendIds.filter((id) => friendsB.has(id)).length;
  }
}
