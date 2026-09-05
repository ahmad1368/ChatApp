import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { createApp } from "./server";
import { SharedDateStore } from "./sharedDates";

const VALID_PAYLOAD = {
  meetingWith: "Jordan",
  location: "Blue Bottle Coffee",
  scheduledAt: "2026-09-10T18:00:00.000Z",
  contactNames: ["Sam", "Priya"],
};

function listen(sharedDateStore = new SharedDateStore()) {
  const { app } = createApp(sharedDateStore);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("POST /api/shared-dates creates a plan with per-contact share codes", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/shared-dates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", ...VALID_PAYLOAD }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.contacts.length, 2);
    assert.equal(body.status, "planned");
  } finally {
    server.close();
  }
});

test("POST /api/shared-dates rejects an invalid payload", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/shared-dates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("PATCH /api/shared-dates/:id/status updates status only for the sharer", async () => {
  const sharedDateStore = new SharedDateStore();
  const created = sharedDateStore.create("alice", VALID_PAYLOAD);
  assert.equal(created.success, true);
  if (!created.success) return;
  const { server, baseUrl } = listen(sharedDateStore);
  try {
    const forbidden = await fetch(`${baseUrl}/api/shared-dates/${created.date.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "mallory", status: "safe" }),
    });
    assert.equal(forbidden.status, 400);

    const ok = await fetch(`${baseUrl}/api/shared-dates/${created.date.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", status: "arrived" }),
    });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.status, "arrived");
  } finally {
    server.close();
  }
});

test("GET /api/shared-dates/shared/:shareCode reflects live status for a trusted contact", async () => {
  const sharedDateStore = new SharedDateStore();
  const created = sharedDateStore.create("alice", VALID_PAYLOAD);
  assert.equal(created.success, true);
  if (!created.success) return;
  sharedDateStore.updateStatus("alice", created.date.id, "on_the_way");
  const { server, baseUrl } = listen(sharedDateStore);
  try {
    const res = await fetch(`${baseUrl}/api/shared-dates/shared/${created.date.contacts[0].shareCode}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "on_the_way");
    assert.equal(body.author, "alice");
  } finally {
    server.close();
  }
});

test("POST /api/shared-dates/:id/revoke invalidates all share codes", async () => {
  const sharedDateStore = new SharedDateStore();
  const created = sharedDateStore.create("alice", VALID_PAYLOAD);
  assert.equal(created.success, true);
  if (!created.success) return;
  const { server, baseUrl } = listen(sharedDateStore);
  try {
    const revokeRes = await fetch(`${baseUrl}/api/shared-dates/${created.date.id}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(revokeRes.status, 204);

    const viewRes = await fetch(`${baseUrl}/api/shared-dates/shared/${created.date.contacts[0].shareCode}`);
    assert.equal(viewRes.status, 404);
  } finally {
    server.close();
  }
});

test("GET /api/shared-dates/shared/:shareCode 404s for an unknown code", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/shared-dates/shared/does-not-exist`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
