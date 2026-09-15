import { generateSticker, isStickerStyle, type StickerStyle } from "./stickerGenerator";

export interface StoredSticker {
  id: string;
  author: string;
  style: StickerStyle;
  data: Buffer;
  createdAt: string;
}

export type GenerateStickerResult = { success: true; sticker: StoredSticker } | { success: false; error: string };

/**
 * Hinge's real "Generate custom chat stickers based on the user's face
 * using AI" (#239) — the storage/catalog half; see stickerGenerator.ts
 * for the honest scoping of the actual image transform. Mirrors
 * #45's `PhotoStore` shape (id -> in-memory Buffer), since a generated
 * sticker is stored and served exactly the same way an uploaded photo
 * is.
 */
export class StickerStore {
  private stickers = new Map<string, StoredSticker>();
  private nextId = 1;

  async generate(author: unknown, photoData: unknown, style: unknown): Promise<GenerateStickerResult> {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };
    if (!isStickerStyle(style)) return { success: false, error: "style is invalid" };
    if (!Buffer.isBuffer(photoData)) return { success: false, error: "photoData is required" };

    let data: Buffer;
    try {
      data = await generateSticker(photoData, style);
    } catch {
      return { success: false, error: "Could not generate a sticker from that photo" };
    }

    const sticker: StoredSticker = { id: String(this.nextId++), author: authorName, style, data, createdAt: new Date().toISOString() };
    this.stickers.set(sticker.id, sticker);
    return { success: true, sticker };
  }

  get(id: string): StoredSticker | undefined {
    return this.stickers.get(id);
  }

  /** This author's own generated sticker pack, newest first. */
  listByAuthor(author: string): StoredSticker[] {
    return [...this.stickers.values()]
      .filter((sticker) => sticker.author === author)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
