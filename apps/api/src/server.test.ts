import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { createApp } from "./server";
import { PhotoStore } from "./photos";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function listen(photoStore = new PhotoStore()) {
  const { app } = createApp(photoStore);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("POST /api/photos uploads a photo", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
  } finally {
    server.close();
  }
});

test("POST /api/photos rejects an invalid mime type", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", mimeType: "image/gif", data: TINY_PNG_BASE64 }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/photos/:id returns a watermarked image, not the original bytes", async () => {
  const photoStore = new PhotoStore();
  const uploaded = photoStore.upload("alice", "image/png", TINY_PNG_BASE64);
  assert.equal(uploaded.success, true);
  const { server, baseUrl } = listen(photoStore);
  try {
    const id = uploaded.success ? uploaded.photo.id : "";
    const res = await fetch(`${baseUrl}/api/photos/${id}?viewer=bob`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/png");
    const served = Buffer.from(await res.arrayBuffer());
    const original = Buffer.from(TINY_PNG_BASE64, "base64");
    assert.notDeepEqual(served, original);
  } finally {
    server.close();
  }
});

test("GET /api/photos/:id 404s for an unknown id", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/photos/does-not-exist`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
