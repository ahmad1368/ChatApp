import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { OnboardingStore } from "./onboarding";
import { UploadStore } from "./uploads";
import { VerificationStore } from "./verification";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("verified badge API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    const verificationStore = new VerificationStore();
    const { app } = createApp(new OnboardingStore(verificationStore), new UploadStore(), verificationStore);
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("reports unverified for a user who never submitted a selfie", async () => {
    const res = await fetch(`${baseUrl}/api/users/user-1/badge`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { verified: false });
  });

  it("reports verified after a selfie is accepted, without exposing the image", async () => {
    await fetch(`${baseUrl}/api/verification/selfie`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2", mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });

    const res = await fetch(`${baseUrl}/api/users/user-2/badge`);
    const body = await res.json();
    assert.deepEqual(body, { verified: true });
    assert.equal("selfie" in body, false);
    assert.equal("data" in body, false);
  });

  it("is independent per user", async () => {
    const res = await fetch(`${baseUrl}/api/users/some-other-user/badge`);
    const body = await res.json();
    assert.equal(body.verified, false);
  });
});
