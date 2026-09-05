import { test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { createApp } from "./server";
import { WebAuthnStore } from "./webauthn";

function listen(webAuthnStore = new WebAuthnStore()) {
  const { app } = createApp(webAuthnStore);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("GET /api/webauthn/status/:author starts unregistered", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/webauthn/status/alice`);
    const body = await res.json();
    assert.equal(body.registered, false);
  } finally {
    server.close();
  }
});

test("POST /api/webauthn/registration/options issues a challenge for a valid author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/webauthn/registration/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.challenge);
  } finally {
    server.close();
  }
});

test("POST /api/webauthn/registration/options rejects a missing author", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/webauthn/registration/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/webauthn/registration/verify rejects without a pending challenge", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/webauthn/registration/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice", response: {} }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/webauthn/authentication/options rejects an author with no registered credential", async () => {
  const { server, baseUrl } = listen();
  try {
    const res = await fetch(`${baseUrl}/api/webauthn/authentication/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "alice" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});
