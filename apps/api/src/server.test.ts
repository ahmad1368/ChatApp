import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { createApp } from "./server";
import { WatermarkStore } from "./watermark";

function listen(watermarkStore = new WatermarkStore()) {
  const { app } = createApp(watermarkStore);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("POST /api/watermark/session issues a trace code", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/watermark/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", roomId: "general" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.author, "alice");
    assert.equal(body.roomId, "general");
    assert.ok(body.traceCode);
  } finally {
    server.close();
  }
});

test("POST /api/watermark/session rejects missing fields", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/watermark/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("issued trace codes are resolvable internally via the store, not via any HTTP endpoint", async () => {
  const watermarkStore = new WatermarkStore();
  const { server, baseUrl } = listen(watermarkStore);
  try {
    const res = await fetch(`${baseUrl}/api/watermark/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", roomId: "general" }),
    });
    const { traceCode } = await res.json();

    const resolved = watermarkStore.lookup(traceCode);
    assert.equal(resolved?.author, "alice");
    assert.equal(resolved?.roomId, "general");

    const leakAttempt = await fetch(`${baseUrl}/api/watermark/${traceCode}`);
    assert.equal(leakAttempt.status, 404);
  } finally {
    server.close();
  }
});
