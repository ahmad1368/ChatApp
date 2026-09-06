import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { createApp } from "./server";

function listen() {
  const { app, messagesByRoom } = createApp();
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}`, messagesByRoom };
}

test("DELETE /api/account/:author erases only that author's messages", async () => {
  const { server, baseUrl, messagesByRoom } = listen();
  messagesByRoom.set("general", [
    { id: "1", roomId: "general", author: "alice", text: "hi", createdAt: new Date().toISOString() },
    { id: "2", roomId: "general", author: "bob", text: "yo", createdAt: new Date().toISOString() },
  ]);
  try {
    const res = await fetch(`${baseUrl}/api/account/alice`, { method: "DELETE" });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.deletedRecordCount, 1);

    const remaining = await (await fetch(`${baseUrl}/api/rooms/general/messages`)).json();
    assert.deepEqual(
      remaining.map((m: { author: string }) => m.author),
      ["bob"]
    );
  } finally {
    server.close();
  }
});

test("DELETE /api/account/:author rejects a missing author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/account/${encodeURIComponent(" ")}`, { method: "DELETE" });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/account/:author/export returns only that author's messages as a download", async () => {
  const { server, baseUrl, messagesByRoom } = listen();
  messagesByRoom.set("general", [
    { id: "1", roomId: "general", author: "alice", text: "hi", createdAt: new Date().toISOString() },
    { id: "2", roomId: "general", author: "bob", text: "yo", createdAt: new Date().toISOString() },
  ]);
  try {
    const res = await fetch(`${baseUrl}/api/account/alice/export`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-disposition") ?? "", /attachment; filename="chatapp-data-alice\.json"/);
    const body = await res.json();
    assert.equal(body.author, "alice");
    assert.deepEqual(
      body.messages.map((m: { author: string }) => m.author),
      ["alice"]
    );
  } finally {
    server.close();
  }
});

test("GET /api/account/:author/export rejects a missing author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/account/${encodeURIComponent(" ")}/export`);
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/account/:author/export for an author with no data returns an empty backup", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/account/nobody/export`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.messages, []);
  } finally {
    server.close();
  }
});

test("PUT /api/users/:author/location stores an exact location and returns only an approximation", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/users/alice/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 37.7749, lng: -122.4194 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.notDeepEqual(body.approximate, { lat: 37.7749, lng: -122.4194 });
    assert.equal(typeof body.approximate.lat, "number");
    assert.equal(typeof body.approximate.lng, "number");
  } finally {
    server.close();
  }
});

test("PUT /api/users/:author/location rejects out-of-range coordinates", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/users/alice/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 999, lng: 0 }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/users/:author/location returns 404 when no location is on file", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/users/nobody/location`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("GET /api/users/:author/location returns the same approximation set via PUT", async () => {
  const { server, baseUrl } = listen();
  try {
    await fetch(`${baseUrl}/api/users/alice/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 51.5074, lng: -0.1278 }),
    });
    const res = await fetch(`${baseUrl}/api/users/alice/location`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.approximate.lat, "number");
  } finally {
    server.close();
  }
});
