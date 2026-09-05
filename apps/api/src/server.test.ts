import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { createApp } from "./server";
import { SafetyPlanStore } from "./safetyPlans";

function listen(safetyPlanStore = new SafetyPlanStore()) {
  const { app } = createApp(safetyPlanStore);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("POST /api/safety/plans creates a plan with a share code", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/safety/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: "alice",
        meetingWith: "Jordan",
        location: "Blue Bottle Coffee",
        scheduledAt: "2026-09-10T18:00:00.000Z",
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.author, "alice");
    assert.ok(body.shareCode);
  } finally {
    server.close();
  }
});

test("POST /api/safety/plans rejects an invalid payload", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/safety/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/safety/plans/shared/:shareCode returns the plan for a trusted contact", async () => {
  const safetyPlanStore = new SafetyPlanStore();
  const created = safetyPlanStore.create("alice", {
    meetingWith: "Jordan",
    location: "Blue Bottle Coffee",
    scheduledAt: "2026-09-10T18:00:00.000Z",
  });
  assert.equal(created.success, true);
  const { server, baseUrl } = listen(safetyPlanStore);
  try {
    const shareCode = created.success ? created.plan.shareCode : "";
    const res = await fetch(`${baseUrl}/api/safety/plans/shared/${shareCode}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.meetingWith, "Jordan");
    assert.equal(body.author, "alice");
  } finally {
    server.close();
  }
});

test("GET /api/safety/plans/shared/:shareCode 404s for an unknown code", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/safety/plans/shared/does-not-exist`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
