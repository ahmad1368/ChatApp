import { test } from "node:test";
import assert from "node:assert/strict";
import { BackgroundCheckService, CreateInvitationFetcher, FetchReportStatusFetcher } from "./backgroundCheck";

test("reports unconfigured when no API key is set", () => {
  const service = new BackgroundCheckService(undefined, async () => undefined, async () => undefined);
  assert.equal(service.isConfigured(), false);
});

test("reports configured once an API key is set", () => {
  const service = new BackgroundCheckService("key", async () => undefined, async () => undefined);
  assert.equal(service.isConfigured(), true);
});

test("createInvitation() returns undefined without calling the fetcher when unconfigured", async () => {
  let called = false;
  const fetcher: CreateInvitationFetcher = async () => {
    called = true;
    return { candidateId: "c1", invitationUrl: "https://checkr.example/invite/c1" };
  };
  const service = new BackgroundCheckService(undefined, fetcher, async () => undefined);
  assert.equal(await service.createInvitation("alice@example.com"), undefined);
  assert.equal(called, false);
});

test("createInvitation() passes the email and api key through to the fetcher", async () => {
  let received: unknown;
  const fetcher: CreateInvitationFetcher = async (email, apiKey) => {
    received = { email, apiKey };
    return { candidateId: "c1", invitationUrl: "https://checkr.example/invite/c1" };
  };
  const service = new BackgroundCheckService("secret-key", fetcher, async () => undefined);
  const result = await service.createInvitation("alice@example.com");
  assert.deepEqual(received, { email: "alice@example.com", apiKey: "secret-key" });
  assert.deepEqual(result, { candidateId: "c1", invitationUrl: "https://checkr.example/invite/c1" });
});

test("createInvitation() propagates a fetch failure as undefined", async () => {
  const service = new BackgroundCheckService("key", async () => undefined, async () => undefined);
  assert.equal(await service.createInvitation("alice@example.com"), undefined);
});

test("fetchReportStatus() returns undefined without calling the fetcher when unconfigured", async () => {
  let called = false;
  const fetcher: FetchReportStatusFetcher = async () => {
    called = true;
    return "clear";
  };
  const service = new BackgroundCheckService(undefined, async () => undefined, fetcher);
  assert.equal(await service.fetchReportStatus("c1"), undefined);
  assert.equal(called, false);
});

test("fetchReportStatus() passes the candidate id and api key through to the fetcher", async () => {
  let received: unknown;
  const fetcher: FetchReportStatusFetcher = async (candidateId, apiKey) => {
    received = { candidateId, apiKey };
    return "clear";
  };
  const service = new BackgroundCheckService("secret-key", async () => undefined, fetcher);
  const status = await service.fetchReportStatus("c1");
  assert.deepEqual(received, { candidateId: "c1", apiKey: "secret-key" });
  assert.equal(status, "clear");
});
