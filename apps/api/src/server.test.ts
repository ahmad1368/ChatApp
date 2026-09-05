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

describe("verification API", () => {
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

  it("requires userId, mimeType, and data", async () => {
    const res = await fetch(`${baseUrl}/api/verification/selfie`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1" }),
    });
    assert.equal(res.status, 400);
  });

  it("accepts a valid selfie and never exposes it via a GET endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/verification/selfie`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.deepEqual(body, { verified: true });

    // There is deliberately no GET /api/verification/... route at all.
    const noRoute = await fetch(`${baseUrl}/api/verification/selfie/user-1`);
    assert.equal(noRoute.status, 404);
  });

  it("wires a submitted selfie into the onboarding selfieVerification step", async () => {
    const steps: [string, unknown][] = [
      ["displayName", "Bob"],
      ["avatar", ""],
      ["bio", ""],
      ["datingGoal", "friendship"],
      ["gender", { option: "man" }],
      ["orientation", { option: "bisexual", interestedIn: ["man", "woman"] }],
      ["ageRange", { min: 22, max: 40 }],
      ["searchRadius", { radiusKm: 50 }],
    ];
    for (const [step, data] of steps) {
      await fetch(`${baseUrl}/api/onboarding/user-2/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, data }),
      });
    }

    await fetch(`${baseUrl}/api/verification/selfie`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-2", mimeType: "image/png", data: TINY_PNG_BASE64 }),
    });

    const res = await fetch(`${baseUrl}/api/onboarding/user-2/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "selfieVerification", data: {} }),
    });
    const body = await res.json();
    assert.equal(body.currentStep, "complete");
    assert.equal(body.profile.isSelfieVerified, true);
  });
});
