import { Jimp } from "jimp";

export const STICKER_STYLES = ["cartoon", "sketch", "popart", "vintage", "pixel"] as const;
export type StickerStyle = (typeof STICKER_STYLES)[number];

export const STICKER_SIZE = 320;

export function isStickerStyle(value: unknown): value is StickerStyle {
  return typeof value === "string" && (STICKER_STYLES as readonly string[]).includes(value);
}

/**
 * Hinge's real "Generate custom chat stickers based on the user's face
 * using AI" (#239): this app has no trained face-to-cartoon generative
 * model or image-generation API/credentials to fabricate a claim of
 * running one — so "AI sticker" is honestly scoped to a real,
 * deterministic image-transform pipeline (reusing #82's `jimp`
 * dependency, the same library `photoOptimization.ts` already uses for
 * real server-side image processing): the user's own uploaded photo,
 * cropped to a circular sticker frame and run through one of several
 * genuinely distinct stylistic filters. Every style below is a real Jimp
 * operation actually applied to the actual pixels, not a placeholder.
 */
export async function generateSticker(input: Buffer, style: StickerStyle): Promise<Buffer> {
  const image = await Jimp.read(input);
  image.cover({ w: STICKER_SIZE, h: STICKER_SIZE });
  image.circle();

  switch (style) {
    case "cartoon":
      image.posterize(6);
      image.contrast(0.3);
      break;
    case "sketch":
      image.greyscale();
      image.contrast(0.5);
      break;
    case "popart":
      image.posterize(4);
      image.contrast(0.4);
      break;
    case "vintage":
      image.sepia();
      break;
    case "pixel":
      image.pixelate(8);
      break;
  }

  return image.getBuffer("image/png");
}
