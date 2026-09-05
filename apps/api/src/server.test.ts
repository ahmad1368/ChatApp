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

  it("progresses through to the dating goal step and persists between requests", async () => {
    await fetch(`${baseUrl}/api/onboarding/user-2/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "displayName", data: "Bob" }),
    });
    await fetch(`${baseUrl}/api/onboarding/user-2/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "avatar", data: "" }),
    });
    const step3 = await fetch(`${baseUrl}/api/onboarding/user-2/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "bio", data: "" }),
    }).then((r) => r.json());
    assert.equal(step3.currentStep, "datingGoal");

    const step4 = await fetch(`${baseUrl}/api/onboarding/user-2/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "datingGoal", data: "friendship" }),
    }).then((r) => r.json());
    assert.equal(step4.currentStep, "complete");
    assert.equal(step4.profile.datingGoal, "friendship");

    const resumed = await fetch(`${baseUrl}/api/onboarding/user-2`).then((r) => r.json());
    assert.equal(resumed.currentStep, "complete");
  });

  it("rejects an invalid dating goal value", async () => {
    await fetch(`${baseUrl}/api/onboarding/user-3/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "displayName", data: "Carol" }),
    });
    await fetch(`${baseUrl}/api/onboarding/user-3/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "avatar", data: "" }),
    });
    await fetch(`${baseUrl}/api/onboarding/user-3/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "bio", data: "" }),
    });
    const res = await fetch(`${baseUrl}/api/onboarding/user-3/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "datingGoal", data: "nonsense" }),
    });
    assert.equal(res.status, 400);
  });

  it("rejects submitting a step out of order", async () => {
    const res = await fetch(`${baseUrl}/api/onboarding/user-4/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "datingGoal", data: "marriage" }),
    });
    assert.equal(res.status, 400);
  });
});
