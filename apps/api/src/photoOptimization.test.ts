import { test } from "node:test";
import assert from "node:assert/strict";
import { Jimp } from "jimp";
import { optimizePhoto, MAX_DIMENSION } from "./photoOptimization";

async function makeBlankPng(width: number, height: number): Promise<Buffer> {
  const image = new Jimp({ width, height, color: 0x336699ff });
  return image.getBuffer("image/png");
}

test("optimizePhoto() leaves a small photo's dimensions unchanged", async () => {
  const original = await makeBlankPng(200, 100);
  const result = await optimizePhoto(original);
  const decoded = await Jimp.read(result.data);
  assert.equal(decoded.width, 200);
  assert.equal(decoded.height, 100);
  assert.equal(result.wasResized, false);
});

test("optimizePhoto() downscales a photo whose longest edge exceeds the max dimension", async () => {
  const original = await makeBlankPng(MAX_DIMENSION + 400, MAX_DIMENSION / 2);
  const result = await optimizePhoto(original);
  const decoded = await Jimp.read(result.data);
  assert.equal(decoded.width, MAX_DIMENSION);
  assert.ok(decoded.height < MAX_DIMENSION / 2);
  assert.equal(result.wasResized, true);
});

test("optimizePhoto() preserves aspect ratio when downscaling", async () => {
  const original = await makeBlankPng(MAX_DIMENSION * 2, MAX_DIMENSION);
  const result = await optimizePhoto(original);
  const decoded = await Jimp.read(result.data);
  assert.equal(decoded.width, MAX_DIMENSION);
  assert.equal(decoded.height, MAX_DIMENSION / 2);
});

test("optimizePhoto() always re-encodes as JPEG regardless of the input format", async () => {
  const original = await makeBlankPng(100, 100);
  const result = await optimizePhoto(original);
  assert.equal(result.mimeType, "image/jpeg");
  assert.deepEqual(result.data.subarray(0, 3), Buffer.from([0xff, 0xd8, 0xff]));
});

test("optimizePhoto() returns a decodable image even when nothing needed resizing", async () => {
  const original = await makeBlankPng(50, 50);
  const result = await optimizePhoto(original);
  const decoded = await Jimp.read(result.data);
  assert.equal(decoded.width, 50);
  assert.equal(decoded.height, 50);
});
