import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { ReportStore } from "./reports";

describe("reports API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;

  before(async () => {
    const { app } = createApp(new ReportStore());
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("rejects a report with an invalid reason", async () => {
    const res = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reporterAuthor: "alice", reportedAuthor: "bob", reason: "nonsense" }),
    });
    assert.equal(res.status, 400);
  });

  it("accepts a valid report", async () => {
    const res = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reporterAuthor: "alice", reportedAuthor: "bob", reason: "harassment", messageId: "msg-1" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
  });

  it("has no GET route exposing stored reports", async () => {
    const res = await fetch(`${baseUrl}/api/reports`);
    assert.equal(res.status, 404);
  });
});
