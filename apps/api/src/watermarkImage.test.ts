import { test } from "node:test";
import assert from "node:assert/strict";
import { Jimp } from "jimp";
import { applyWatermark } from "./watermarkImage";

async function makeBlankPng(width: number, height: number): Promise<Buffer> {
  const image = new Jimp({ width, height, color: 0x336699ff });
  return image.getBuffer("image/png");
}

test("applyWatermark() returns a decodable image of the same dimensions", async () => {
  const original = await makeBlankPng(120, 80);
  const watermarked = await applyWatermark(original, "guest-1");
  const decoded = await Jimp.read(watermarked);
  assert.equal(decoded.width, 120);
  assert.equal(decoded.height, 80);
});

test("applyWatermark() actually changes the pixel data", async () => {
  const original = await makeBlankPng(120, 80);
  const watermarked = await applyWatermark(original, "guest-1");
  assert.notDeepEqual(watermarked, original);
});

test("applyWatermark() produces different output for different labels", async () => {
  const original = await makeBlankPng(120, 80);
  const a = await applyWatermark(original, "guest-1");
  const b = await applyWatermark(original, "guest-2");
  assert.notDeepEqual(a, b);
});
