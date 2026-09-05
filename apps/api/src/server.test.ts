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
