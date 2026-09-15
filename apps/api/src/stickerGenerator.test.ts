import test from "node:test";
import assert from "node:assert/strict";
import { Jimp } from "jimp";
import { generateSticker, isStickerStyle, STICKER_SIZE, STICKER_STYLES } from "./stickerGenerator";

async function samplePhotoBuffer(): Promise<Buffer> {
  const image = new Jimp({ width: 64, height: 40, color: 0xff8844ff });
  return image.getBuffer("image/png");
}

test("isStickerStyle() accepts only real catalog styles", () => {
  assert.equal(isStickerStyle("cartoon"), true);
  assert.equal(isStickerStyle("not-a-real-style"), false);
  assert.equal(isStickerStyle(42), false);
});

for (const style of STICKER_STYLES) {
  test(`generateSticker() produces a real ${style} PNG at the sticker size`, async () => {
    const input = await samplePhotoBuffer();
    const output = await generateSticker(input, style);
    assert.ok(output.length > 0);

    const decoded = await Jimp.read(output);
    assert.equal(decoded.width, STICKER_SIZE);
    assert.equal(decoded.height, STICKER_SIZE);
  });
}

test("generateSticker() actually changes the pixel data, not a passthrough copy", async () => {
  const input = await samplePhotoBuffer();
  const cartoon = await generateSticker(input, "cartoon");
  const vintage = await generateSticker(input, "vintage");
  // Different styles applied to the same source photo must produce different bytes.
  assert.notDeepEqual(cartoon, vintage);
  assert.notDeepEqual(cartoon, input);
});
