import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { OnboardingStore } from "./onboarding";

async function stepThroughToSearchRadius(baseUrl: string, userId: string) {
  const steps: [string, unknown][] = [
    ["displayName", "Bob"],
    ["avatar", ""],
    ["bio", ""],
    ["datingGoal", "friendship"],
    ["gender", { option: "man" }],
    ["orientation", { option: "bisexual", interestedIn: ["man", "woman"] }],
    ["ageRange", { min: 22, max: 40 }],
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

  it("completes the search radius step with a rounded location and persists", async () => {
    await stepThroughToSearchRadius(baseUrl, "user-2");
    const res = await fetch(`${baseUrl}/api/onboarding/user-2/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "searchRadius", data: { radiusKm: 30, location: { lat: 51.507351, lng: -0.127758 } } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.currentStep, "complete");
    assert.equal(body.profile.searchRadiusKm, 30);
    assert.deepEqual(body.profile.location, { lat: 51.51, lng: -0.13 });

    const resumed = await fetch(`${baseUrl}/api/onboarding/user-2`).then((r) => r.json());
    assert.equal(resumed.currentStep, "complete");
  });

  it("completes without a location when geolocation is denied", async () => {
    await stepThroughToSearchRadius(baseUrl, "user-3");
    const res = await fetch(`${baseUrl}/api/onboarding/user-3/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "searchRadius", data: { radiusKm: 80 } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.profile.searchRadiusKm, 80);
    assert.equal(body.profile.location, undefined);
  });

  it("rejects a radius outside the allowed bounds", async () => {
    await stepThroughToSearchRadius(baseUrl, "user-4");
    const res = await fetch(`${baseUrl}/api/onboarding/user-4/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "searchRadius", data: { radiusKm: 500 } }),
    });
    assert.equal(res.status, 400);
  });

  it("rejects submitting the search radius step out of order", async () => {
    const res = await fetch(`${baseUrl}/api/onboarding/user-5/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "searchRadius", data: { radiusKm: 25 } }),
    });
    assert.equal(res.status, 400);
  });
});
