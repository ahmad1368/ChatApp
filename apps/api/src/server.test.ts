import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { createApp } from "./server";
import { SOSStore } from "./sos";

const VALID_LOCATION = { latitude: 37.7749, longitude: -122.4194, accuracy: 12 };

function listen(sosStore = new SOSStore()) {
  const { app } = createApp(sosStore);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("POST /api/sos/contacts registers an emergency contact", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/sos/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", name: "Sam", contactMethod: "+15551234567" }),
    });
    assert.equal(res.status, 201);

    const list = await fetch(`${baseUrl}/api/sos/contacts/alice`);
    const body = await list.json();
    assert.equal(body.contacts.length, 1);
  } finally {
    server.close();
  }
});

test("POST /api/sos/alerts rejects triggering without registered contacts", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/sos/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", ...VALID_LOCATION }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/sos/alerts triggers an alert and issues per-contact share codes", async () => {
  const sosStore = new SOSStore();
  sosStore.addContact("alice", "Sam", "+15551234567");
  sosStore.addContact("alice", "Priya", "priya@example.com");
  const { server, baseUrl } = listen(sosStore);
  try {
    const res = await fetch(`${baseUrl}/api/sos/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", ...VALID_LOCATION }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.contacts.length, 2);
    assert.equal(body.resolved, false);
  } finally {
    server.close();
  }
});

test("PATCH /api/sos/alerts/:id/location updates the live position for trusted contacts", async () => {
  const sosStore = new SOSStore();
  sosStore.addContact("alice", "Sam", "+15551234567");
  const created = sosStore.triggerSOS("alice", VALID_LOCATION);
  assert.equal(created.success, true);
  if (!created.success) return;
  const { server, baseUrl } = listen(sosStore);
  try {
    const res = await fetch(`${baseUrl}/api/sos/alerts/${created.alert.id}/location`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", latitude: 1, longitude: 1 }),
    });
    assert.equal(res.status, 200);

    const view = await fetch(`${baseUrl}/api/sos/alerts/shared/${created.alert.contacts[0].shareCode}`);
    const viewBody = await view.json();
    assert.equal(viewBody.location.latitude, 1);
  } finally {
    server.close();
  }
});

test("POST /api/sos/alerts/:id/resolve marks the alert resolved for viewers", async () => {
  const sosStore = new SOSStore();
  sosStore.addContact("alice", "Sam", "+15551234567");
  const created = sosStore.triggerSOS("alice", VALID_LOCATION);
  assert.equal(created.success, true);
  if (!created.success) return;
  const { server, baseUrl } = listen(sosStore);
  try {
    const res = await fetch(`${baseUrl}/api/sos/alerts/${created.alert.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 204);

    const view = await fetch(`${baseUrl}/api/sos/alerts/shared/${created.alert.contacts[0].shareCode}`);
    const viewBody = await view.json();
    assert.equal(viewBody.resolved, true);
  } finally {
    server.close();
  }
});

test("GET /api/sos/alerts/shared/:shareCode 404s for an unknown code", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/sos/alerts/shared/does-not-exist`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
