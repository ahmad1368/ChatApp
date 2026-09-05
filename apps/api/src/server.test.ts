import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { OnboardingStore } from "./onboarding";

async function stepThroughToGender(baseUrl: string, userId: string) {
  for (const [step, data] of [
    ["displayName", "Bob"],
    ["avatar", ""],
    ["bio", ""],
    ["datingGoal", "friendship"],
  ] as const) {
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

  it("rejects an unrecognized step", async () => {
    const res = await fetch(`${baseUrl}/api/onboarding/user-1/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "not-a-real-step", data: "x" }),
    });
    assert.equal(res.status, 400);
  });

  it("completes the gender step and persists between requests", async () => {
    await stepThroughToGender(baseUrl, "user-2");
    const res = await fetch(`${baseUrl}/api/onboarding/user-2/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "gender", data: { option: "nonBinary" } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.currentStep, "complete");
    assert.equal(body.profile.gender, "nonBinary");

    const resumed = await fetch(`${baseUrl}/api/onboarding/user-2`).then((r) => r.json());
    assert.equal(resumed.currentStep, "complete");
  });

  it("rejects a custom gender option missing its description", async () => {
    await stepThroughToGender(baseUrl, "user-3");
    const res = await fetch(`${baseUrl}/api/onboarding/user-3/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "gender", data: { option: "custom" } }),
    });
    assert.equal(res.status, 400);
  });

  it("accepts a custom gender description", async () => {
    await stepThroughToGender(baseUrl, "user-4");
    const res = await fetch(`${baseUrl}/api/onboarding/user-4/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "gender", data: { option: "custom", customText: "Bigender" } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.profile.genderCustomText, "Bigender");
  });

  it("rejects submitting the gender step out of order", async () => {
    const res = await fetch(`${baseUrl}/api/onboarding/user-5/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "gender", data: { option: "woman" } }),
    });
    assert.equal(res.status, 400);
  });
});
