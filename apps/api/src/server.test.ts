import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { createApp } from "./server";
import { BlockStore } from "./blocks";

function listen(blockStore: BlockStore) {
  const { app } = createApp(blockStore);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("POST /api/blocks creates a block", async () => {
  const { server, baseUrl } = listen(new BlockStore());
  try {
    const res = await fetch(`${baseUrl}/api/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice", blockedAuthor: "bob" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.blockerAuthor, "alice");
    assert.equal(body.blockedAuthor, "bob");
  } finally {
    server.close();
  }
});

test("POST /api/blocks rejects missing fields", async () => {
  const { server, baseUrl } = listen(new BlockStore());
  try {
    const res = await fetch(`${baseUrl}/api/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("GET /api/blocks/:blockerAuthor returns only that author's own blocks", async () => {
  const blockStore = new BlockStore();
  blockStore.block("alice", "bob");
  blockStore.block("dave", "alice");
  const { server, baseUrl } = listen(blockStore);
  try {
    const res = await fetch(`${baseUrl}/api/blocks/alice`);
    const body = await res.json();
    assert.deepEqual(body.blockedAuthors, ["bob"]);
  } finally {
    server.close();
  }
});

test("DELETE /api/blocks removes a block, 404s if absent", async () => {
  const blockStore = new BlockStore();
  blockStore.block("alice", "bob");
  const { server, baseUrl } = listen(blockStore);
  try {
    const ok = await fetch(`${baseUrl}/api/blocks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice", blockedAuthor: "bob" }),
    });
    assert.equal(ok.status, 204);

    const missing = await fetch(`${baseUrl}/api/blocks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerAuthor: "alice", blockedAuthor: "bob" }),
    });
    assert.equal(missing.status, 404);
  } finally {
    server.close();
  }
});

test("GET /api/rooms/:roomId/messages filters mutually-blocked authors for a viewer", async () => {
  const blockStore = new BlockStore();
  blockStore.block("alice", "bob");
  const { app, messagesByRoom } = createApp(blockStore);
  messagesByRoom.set("general", [
    { id: "1", roomId: "general", author: "bob", text: "hi", createdAt: new Date().toISOString() },
    { id: "2", roomId: "general", author: "carol", text: "hey", createdAt: new Date().toISOString() },
  ]);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/rooms/general/messages?viewer=alice`);
    const body = await res.json();
    assert.deepEqual(
      body.map((m: { author: string }) => m.author),
      ["carol"]
    );

    const unfiltered = await fetch(`http://127.0.0.1:${port}/api/rooms/general/messages`);
    const unfilteredBody = await unfiltered.json();
    assert.equal(unfilteredBody.length, 2);
  } finally {
    server.close();
  }
});
