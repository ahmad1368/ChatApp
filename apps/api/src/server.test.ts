import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { OnboardingStore } from "./onboarding";

async function stepThroughToOrientation(baseUrl: string, userId: string) {
  const steps: [string, unknown][] = [
    ["displayName", "Bob"],
    ["avatar", ""],
    ["bio", ""],
    ["datingGoal", "friendship"],
    ["gender", { option: "man" }],
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

  it("completes the orientation step and persists between requests", async () => {
    await stepThroughToOrientation(baseUrl, "user-2");
    const res = await fetch(`${baseUrl}/api/onboarding/user-2/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "orientation", data: { option: "bisexual", interestedIn: ["man", "woman", "nonBinary"] } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.currentStep, "complete");
    assert.equal(body.profile.orientation, "bisexual");
    assert.deepEqual(body.profile.interestedIn, ["man", "woman", "nonBinary"]);

    const resumed = await fetch(`${baseUrl}/api/onboarding/user-2`).then((r) => r.json());
    assert.equal(resumed.currentStep, "complete");
  });

  it("rejects an empty interestedIn list", async () => {
    await stepThroughToOrientation(baseUrl, "user-3");
    const res = await fetch(`${baseUrl}/api/onboarding/user-3/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "orientation", data: { option: "gay", interestedIn: [] } }),
    });
    assert.equal(res.status, 400);
  });

  it("rejects a custom orientation missing its description", async () => {
    await stepThroughToOrientation(baseUrl, "user-4");
    const res = await fetch(`${baseUrl}/api/onboarding/user-4/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "orientation", data: { option: "custom", interestedIn: ["woman"] } }),
    });
    assert.equal(res.status, 400);
  });

  it("rejects submitting the orientation step out of order", async () => {
    const res = await fetch(`${baseUrl}/api/onboarding/user-5/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "orientation", data: { option: "straight", interestedIn: ["woman"] } }),
    });
    assert.equal(res.status, 400);
  });
});
