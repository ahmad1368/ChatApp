import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { OnboardingStore } from "./onboarding";
import { UploadStore } from "./uploads";

// A 1x1 red PNG, small enough to keep the test fast.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("uploads + avatar onboarding API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    const { app } = createApp(new OnboardingStore(), new UploadStore());
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("rejects an unsupported mime type", async () => {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/gif", data: TINY_PNG_BASE64 }),
    });
    assert.equal(res.status, 400);
  });

  it("stores a cropped avatar upload and serves it back", async () => {
    const uploadRes = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });
    assert.equal(uploadRes.status, 201);
    const { url } = await uploadRes.json();
    assert.match(url, /^\/api\/uploads\/[\w-]+$/);

    const getRes = await fetch(`${baseUrl}${url}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get("content-type"), "image/png");
  });

  it("returns 404 for an unknown upload id", async () => {
    const res = await fetch(`${baseUrl}/api/uploads/does-not-exist`);
    assert.equal(res.status, 404);
  });

  it("wires an uploaded avatar into the onboarding avatar step", async () => {
    await fetch(`${baseUrl}/api/onboarding/user-1/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "displayName", data: "Alice" }),
    });

    const uploadRes = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });
    const { url } = await uploadRes.json();

    const stepRes = await fetch(`${baseUrl}/api/onboarding/user-1/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "avatar", data: url }),
    });
    assert.equal(stepRes.status, 200);
    const body = await stepRes.json();
    assert.equal(body.profile.avatarUrl, url);
  });
});
