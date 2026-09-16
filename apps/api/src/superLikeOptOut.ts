/**
 * Tinder's real "Ability to disable receiving Super Likes" (#308) — a
 * per-author, on/off toggle. Enforcement lives in server.ts's
 * `POST /api/swipes` handler: an incoming "superlike" aimed at an author
 * who has this enabled is silently downgraded to a regular "like" rather
 * than rejected outright, so the swiper's action still registers and the
 * swiper isn't charged a Super Like (see swipes.ts's daily-limit/credit
 * accounting) for one that was never actually delivered as one.
 */
export class SuperLikeOptOutStore {
  private disabledAuthors = new Set<string>();

  setDisabled(author: string, disabled: boolean): void {
    if (disabled) {
      this.disabledAuthors.add(author);
    } else {
      this.disabledAuthors.delete(author);
    }
  }

  isDisabled(author: string): boolean {
    return this.disabledAuthors.has(author);
  }
}
