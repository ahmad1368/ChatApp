import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { PushService } from "./push";

describe("push API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    const pushService = new PushService();
    const { app } = createApp(pushService);
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("exposes a VAPID public key", async () => {
    const res = await fetch(`${baseUrl}/api/push/public-key`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.publicKey, "string");
    assert.ok(body.publicKey.length > 0);
  });

  it("rejects a subscribe request missing required fields", async () => {
    const res = await fetch(`${baseUrl}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 400);
  });

  it("accepts a valid subscription and unsubscribe", async () => {
    const subscribeRes = await fetch(`${baseUrl}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: "alice",
        subscription: {
          endpoint: "https://push.example.com/abc123",
          keys: { p256dh: "key", auth: "auth" },
        },
      }),
    });
    assert.equal(subscribeRes.status, 201);

    const unsubscribeRes = await fetch(`${baseUrl}/api/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "https://push.example.com/abc123" }),
    });
    assert.equal(unsubscribeRes.status, 200);
  });

  it("rejects an unsubscribe request missing an endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });
});
