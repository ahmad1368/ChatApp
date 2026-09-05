import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./server";
import { ErrorReportStore } from "./errorReports";

describe("error reporting API", () => {
  let baseUrl: string;
  let httpServer: ReturnType<typeof createServer>;
  let errorReportStore: ErrorReportStore;

  before(async () => {
    errorReportStore = new ErrorReportStore();
    const { app } = createApp(errorReportStore);
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("rejects a report missing a message", async () => {
    const res = await fetch(`${baseUrl}/api/error-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stack: "at foo()" }),
    });
    assert.equal(res.status, 400);
  });

  it("accepts a valid report and stores it", async () => {
    const res = await fetch(`${baseUrl}/api/error-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "TypeError: x is not a function",
        stack: "at ChatRoom (ChatRoom.tsx:10)",
        url: "/room/general",
        userAgent: "test-agent",
      }),
    });
    assert.equal(res.status, 202);
    const body = await res.json();
    assert.ok(body.id);
    assert.equal(errorReportStore.count(), 1);
  });
});
