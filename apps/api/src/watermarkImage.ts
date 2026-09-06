import { Jimp, loadFont, BlendMode } from "jimp";
import { SANS_16_WHITE } from "jimp/fonts";

const TILE_WIDTH = 140;
const TILE_HEIGHT = 26;
const OPACITY = 0.35;

/**
 * Burns a tiled, semi-transparent text watermark into the actual pixel data
 * before serving an image, per the reference app's "inject watermarks
 * dynamically when serving images" guidance. Unlike a DOM/CSS overlay, this
 * survives any copy of the served bytes (download, re-upload, screenshot of
 * the raw file), which is what makes it a real deterrent against photo theft
 * rather than something strippable client-side.
 */
export async function applyWatermark(input: Buffer, label: string): Promise<Buffer> {
  const image = await Jimp.read(input);
  const font = await loadFont(SANS_16_WHITE);

  const tile = new Jimp({ width: TILE_WIDTH, height: TILE_HEIGHT, color: 0x00000000 });
  tile.print({ font, x: 0, y: 0, text: label });

  for (let y = 0; y < image.height; y += TILE_HEIGHT) {
    for (let x = 0; x < image.width; x += TILE_WIDTH) {
      image.composite(tile, x, y, { mode: BlendMode.SRC_OVER, opacitySource: OPACITY });
    }
  }

  return image.getBuffer("image/png");
}
