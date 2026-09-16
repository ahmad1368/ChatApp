import { createHash } from "crypto";

export function hashImageBytes(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export interface DuplicatePhotoCheck {
  isDuplicate: boolean;
  usedByOtherAuthors: string[];
}

/**
 * Tinder's real "System to detect duplicate or internet-copied images"
 * (#267) — honestly scoped to the half that's actually buildable here:
 * a real cryptographic hash of the exact uploaded bytes, catching a
 * photo stolen and re-uploaded byte-for-byte across multiple profiles
 * (a genuine, common catfishing pattern), the same way real reverse-
 * image tools like TinEye work for exact copies. Detecting a resized,
 * recompressed, or cropped copy needs perceptual hashing, and detecting
 * a photo copied from somewhere else on the internet needs a live
 * reverse-image-search API/credentials — neither exists in this
 * environment, so this is disclosed as exact-duplicate detection only,
 * not a fabricated full reverse-image-search integration.
 */
export class DuplicatePhotoDetector {
  private authorsByHash = new Map<string, Set<string>>();
  private flaggedAuthors = new Set<string>();

  /** Records this author's use of the image's exact bytes, and reports whether any *other* author already used the identical bytes. */
  recordAndCheck(author: string, data: Buffer): DuplicatePhotoCheck {
    const hash = hashImageBytes(data);
    const authors = this.authorsByHash.get(hash) ?? new Set<string>();
    const usedByOtherAuthors = Array.from(authors).filter((a) => a !== author);
    authors.add(author);
    this.authorsByHash.set(hash, authors);

    if (usedByOtherAuthors.length > 0) {
      this.flaggedAuthors.add(author);
      for (const other of usedByOtherAuthors) this.flaggedAuthors.add(other);
    }
    return { isDuplicate: usedByOtherAuthors.length > 0, usedByOtherAuthors };
  }

  /** True once this author has ever uploaded a photo whose exact bytes are also used by a different author — the signal fakeProfileDetector.ts consumes. */
  isFlagged(author: string): boolean {
    return this.flaggedAuthors.has(author);
  }
}
