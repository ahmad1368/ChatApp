import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { OnboardingStore } from "./onboarding";

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

  it("progresses through the flow and persists between requests", async () => {
    const step1 = await fetch(`${baseUrl}/api/onboarding/user-2/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "displayName", data: "Bob" }),
    }).then((r) => r.json());
    assert.equal(step1.currentStep, "avatar");

    const resumed = await fetch(`${baseUrl}/api/onboarding/user-2`).then((r) => r.json());
    assert.equal(resumed.currentStep, "avatar");
    assert.equal(resumed.profile.displayName, "Bob");
  });

  it("rejects submitting a step out of order", async () => {
    const res = await fetch(`${baseUrl}/api/onboarding/user-3/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "bio", data: "hello" }),
    });
    assert.equal(res.status, 400);
  });
});
