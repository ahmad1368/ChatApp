import test from "node:test";
import assert from "node:assert/strict";
import { Jimp } from "jimp";
import { StickerStore } from "./stickers";

async function samplePhotoBuffer(): Promise<Buffer> {
  const image = new Jimp({ width: 64, height: 40, color: 0x3366ffff });
  return image.getBuffer("image/png");
}

test("generate() rejects a missing author, invalid style, or missing photo data", async () => {
  const store = new StickerStore();
  const photo = await samplePhotoBuffer();
  assert.equal((await store.generate("", photo, "cartoon")).success, false);
  assert.equal((await store.generate("alice", photo, "not-a-real-style")).success, false);
  assert.equal((await store.generate("alice", "not-a-buffer", "cartoon")).success, false);
});

test("generate() succeeds and stores a real sticker retrievable by id", async () => {
  const store = new StickerStore();
  const photo = await samplePhotoBuffer();
  const result = await store.generate("alice", photo, "cartoon");
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.sticker.author, "alice");
  assert.equal(result.sticker.style, "cartoon");
  assert.ok(result.sticker.data.length > 0);
  assert.equal(store.get(result.sticker.id)?.id, result.sticker.id);
});

test("generate() rejects data that isn't a decodable image", async () => {
  const store = new StickerStore();
  const result = await store.generate("alice", Buffer.from("not an image"), "cartoon");
  assert.equal(result.success, false);
});

test("get() returns undefined for an unknown id", () => {
  const store = new StickerStore();
  assert.equal(store.get("not-a-real-id"), undefined);
});

test("listByAuthor() returns only that author's stickers, newest first", async () => {
  const store = new StickerStore();
  const photo = await samplePhotoBuffer();
  const first = await store.generate("alice", photo, "cartoon");
  const second = await store.generate("alice", photo, "sketch");
  await store.generate("bob", photo, "vintage");
  if (!first.success || !second.success) return;

  const aliceStickers = store.listByAuthor("alice");
  assert.equal(aliceStickers.length, 2);
  assert.equal(aliceStickers[0].id, second.sticker.id);
  assert.equal(aliceStickers[1].id, first.sticker.id);
});
