const MAX_NOTE_LENGTH = 500;

export type SetProfileNoteResult = { success: true; note: string } | { success: false; error: string };

/**
 * Tinder's real "Ability to add a private note on someone's profile
 * (visible only to you)" (#307) — a personal memo the viewer writes about
 * a profile they're looking at (e.g. "met at Sarah's birthday party"),
 * scoped strictly per-viewer: never returned by any route that isn't the
 * note's own author, and never surfaced to the profile's subject. Distinct
 * from #112's `photoNotes.ts` (a note left on a specific photo, visible to
 * the photo's owner and posted publicly under the sender's name) — this is
 * the opposite: invisible to everyone but the person who wrote it.
 */
export class ProfileNoteStore {
  private notesByViewer = new Map<string, Map<string, string>>();

  setNote(viewer: string, subject: string, text: unknown): SetProfileNoteResult {
    const trimmed = typeof text === "string" ? text.trim() : "";
    if (trimmed.length > MAX_NOTE_LENGTH) {
      return { success: false, error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer` };
    }

    const notes = this.notesByViewer.get(viewer) ?? new Map<string, string>();
    if (trimmed) {
      notes.set(subject, trimmed);
    } else {
      notes.delete(subject);
    }
    this.notesByViewer.set(viewer, notes);
    return { success: true, note: trimmed };
  }

  getNote(viewer: string, subject: string): string | null {
    return this.notesByViewer.get(viewer)?.get(subject) ?? null;
  }

  deleteNote(viewer: string, subject: string): void {
    this.notesByViewer.get(viewer)?.delete(subject);
  }
}
