import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { OnboardingStore } from "./onboarding";

async function stepThroughToAgeRange(baseUrl: string, userId: string) {
  const steps: [string, unknown][] = [
    ["displayName", "Bob"],
    ["avatar", ""],
    ["bio", ""],
    ["datingGoal", "friendship"],
    ["gender", { option: "man" }],
    ["orientation", { option: "bisexual", interestedIn: ["man", "woman"] }],
  ];
  for (const [step, data] of steps) {
    await fetch(`${baseUrl}/api/onboarding/${userId}/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, data }),
    });
  }
}

describe("onboarding API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    const { app } = createApp(new OnboardingStore());
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("starts a fresh user at the displayName step", async () => {
    const res = await fetch(`${baseUrl}/api/onboarding/user-1`);
    const body = await res.json();
    assert.equal(body.currentStep, "displayName");
  });

  it("completes the age range step and persists between requests", async () => {
    await stepThroughToAgeRange(baseUrl, "user-2");
    const res = await fetch(`${baseUrl}/api/onboarding/user-2/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "ageRange", data: { min: 22, max: 40 } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.currentStep, "complete");
    assert.deepEqual(body.profile.preferredAgeRange, { min: 22, max: 40 });

    const resumed = await fetch(`${baseUrl}/api/onboarding/user-2`).then((r) => r.json());
    assert.equal(resumed.currentStep, "complete");
  });

  it("rejects a range below the legal minimum age", async () => {
    await stepThroughToAgeRange(baseUrl, "user-3");
    const res = await fetch(`${baseUrl}/api/onboarding/user-3/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "ageRange", data: { min: 15, max: 25 } }),
    });
    assert.equal(res.status, 400);
  });

  it("rejects min greater than max", async () => {
    await stepThroughToAgeRange(baseUrl, "user-4");
    const res = await fetch(`${baseUrl}/api/onboarding/user-4/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "ageRange", data: { min: 50, max: 30 } }),
    });
    assert.equal(res.status, 400);
  });

  it("rejects submitting the age range step out of order", async () => {
    const res = await fetch(`${baseUrl}/api/onboarding/user-5/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "ageRange", data: { min: 25, max: 35 } }),
    });
    assert.equal(res.status, 400);
  });
});
