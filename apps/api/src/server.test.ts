import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { createApp } from "./server";
import { BlockStore } from "./blocks";
import { ContactBlockStore } from "./contactBlocks";

function listen(blockStore = new BlockStore(), contactBlockStore = new ContactBlockStore()) {
  const { app, messagesByRoom } = createApp(blockStore, contactBlockStore);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}`, messagesByRoom };
}

test("POST /api/blocks creates a block", async () => {
  const { server, baseUrl } = listen();
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
  const { server, baseUrl } = listen();
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
  const { server, baseUrl, messagesByRoom } = listen(blockStore);
  messagesByRoom.set("general", [
    { id: "1", roomId: "general", author: "bob", text: "hi", createdAt: new Date().toISOString() },
    { id: "2", roomId: "general", author: "carol", text: "hey", createdAt: new Date().toISOString() },
  ]);
  try {
    const res = await fetch(`${baseUrl}/api/rooms/general/messages?viewer=alice`);
    const body = await res.json();
    assert.deepEqual(
      body.map((m: { author: string }) => m.author),
      ["carol"]
    );

    const unfiltered = await fetch(`${baseUrl}/api/rooms/general/messages`);
    const unfilteredBody = await unfiltered.json();
    assert.equal(unfilteredBody.length, 2);
  } finally {
    server.close();
  }
});

test("POST /api/profile/phone registers a phone, rejects invalid input", async () => {
  const { server, baseUrl } = listen();
  try {
    const ok = await fetch(`${baseUrl}/api/profile/phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob", phoneNumber: "555-123-4567" }),
    });
    assert.equal(ok.status, 204);

    const bad = await fetch(`${baseUrl}/api/profile/phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob", phoneNumber: "123" }),
    });
    assert.equal(bad.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/contacts/block blocks authors matching an uploaded contact list", async () => {
  const blockStore = new BlockStore();
  const contactBlockStore = new ContactBlockStore();
  const { server, baseUrl } = listen(blockStore, contactBlockStore);
  try {
    await fetch(`${baseUrl}/api/profile/phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "bob", phoneNumber: "555-123-4567" }),
    });

    const res = await fetch(`${baseUrl}/api/contacts/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", phoneNumbers: ["555.123.4567", "000-000-0000"] }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.blockedAuthors, ["bob"]);
    assert.equal(blockStore.isMutuallyBlocked("alice", "bob"), true);
  } finally {
    server.close();
  }
});

test("POST /api/contacts/block requires an author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/contacts/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumbers: ["5551234567"] }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});
