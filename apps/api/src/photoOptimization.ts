import { Jimp } from "jimp";

export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 82;

export interface OptimizedPhoto {
  data: Buffer;
  mimeType: string;
  wasResized: boolean;
}

/**
 * "Smart" server-side photo optimization (#82): downscales any photo whose
 * longest edge exceeds MAX_DIMENSION and always re-encodes as JPEG at a
 * fixed quality. The "smart" part is skipping the resize step for photos
 * already small enough rather than always re-processing.
 *
 * The bigger payoff than file size is privacy: decoding to a raw pixel
 * buffer and re-encoding (rather than copying the original bytes) drops
 * EXIF metadata entirely, including the GPS coordinates a phone photo can
 * carry — a real, well-known dating-app safety issue (a photo can leak a
 * user's home address). This is the server-side backstop for the client-
 * side compression in imageCompression.ts, covering uploads from clients
 * that skip or can't run that browser-only pipeline.
 */
export async function optimizePhoto(input: Buffer): Promise<OptimizedPhoto> {
  const image = await Jimp.read(input);
  const longestEdge = Math.max(image.width, image.height);
  const wasResized = longestEdge > MAX_DIMENSION;
  if (wasResized) {
    const scale = MAX_DIMENSION / longestEdge;
    image.resize({ w: Math.round(image.width * scale), h: Math.round(image.height * scale) });
  }

  const data = await image.getBuffer("image/jpeg", { quality: JPEG_QUALITY });
  return { data, mimeType: "image/jpeg", wasResized };
}
