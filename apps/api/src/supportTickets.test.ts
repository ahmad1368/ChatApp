import test from "node:test";
import assert from "node:assert/strict";
import { SupportTicketStore } from "./supportTickets";

test("create() rejects a missing author, subject, or message", () => {
  const store = new SupportTicketStore();
  assert.equal(store.create("", "Help", "I need help").success, false);
  assert.equal(store.create("alice", "", "I need help").success, false);
  assert.equal(store.create("alice", "Help", "").success, false);
});

test("create() rejects an over-length subject or message", () => {
  const store = new SupportTicketStore();
  assert.equal(store.create("alice", "a".repeat(101), "message").success, false);
  assert.equal(store.create("alice", "Help", "a".repeat(2001)).success, false);
});

test("create() succeeds, defaults status to open, and seeds the first message from the user", () => {
  const store = new SupportTicketStore();
  const result = store.create("alice", "Can't log in", "My account is stuck on the loading screen");
  assert.equal(result.success, true);
  assert.equal(result.success && result.ticket.status, "open");
  assert.equal(result.success && result.ticket.messages.length, 1);
  assert.equal(result.success && result.ticket.messages[0].sender, "user");
});

test("get() returns a ticket by id or undefined", () => {
  const store = new SupportTicketStore();
  const created = store.create("alice", "Help", "message");
  const id = created.success ? created.ticket.id : "";
  assert.equal(store.get(id)?.author, "alice");
  assert.equal(store.get("nope"), undefined);
});

test("listForAuthor() only returns that author's tickets, most recently updated first", () => {
  const store = new SupportTicketStore();
  const first = store.create("alice", "First issue", "message 1");
  const second = store.create("alice", "Second issue", "message 2");
  store.create("bob", "Bob's issue", "message");

  const aliceTickets = store.listForAuthor("alice");
  assert.equal(aliceTickets.length, 2);
  assert.equal(aliceTickets[0].id, second.success ? second.ticket.id : "");

  if (first.success) store.reply(first.ticket.id, "user", "alice", "one more thing");
  const afterReply = store.listForAuthor("alice");
  assert.equal(afterReply[0].id, first.success ? first.ticket.id : "");
});

test("reply() rejects an unknown ticket, invalid sender, missing senderName, or missing text", () => {
  const store = new SupportTicketStore();
  const created = store.create("alice", "Help", "message");
  const id = created.success ? created.ticket.id : "";
  assert.equal(store.reply("nope", "user", "alice", "text").success, false);
  assert.equal(store.reply(id, "system", "alice", "text").success, false);
  assert.equal(store.reply(id, "user", "", "text").success, false);
  assert.equal(store.reply(id, "user", "alice", "").success, false);
});

test("an admin reply moves an open ticket to inProgress", () => {
  const store = new SupportTicketStore();
  const created = store.create("alice", "Help", "message");
  const id = created.success ? created.ticket.id : "";
  const result = store.reply(id, "admin", "admin-1", "Looking into this now");
  assert.equal(result.success, true);
  assert.equal(result.success && result.ticket.status, "inProgress");
  assert.equal(result.success && result.ticket.messages.length, 2);
});

test("an admin reply on a resolved ticket does not reopen it", () => {
  const store = new SupportTicketStore();
  const created = store.create("alice", "Help", "message");
  const id = created.success ? created.ticket.id : "";
  store.updateStatus(id, "resolved");
  const result = store.reply(id, "admin", "admin-1", "Following up");
  assert.equal(result.success && result.ticket.status, "resolved");
});

test("updateStatus() rejects an unknown ticket or invalid status", () => {
  const store = new SupportTicketStore();
  const created = store.create("alice", "Help", "message");
  const id = created.success ? created.ticket.id : "";
  assert.equal(store.updateStatus("nope", "resolved").success, false);
  assert.equal(store.updateStatus(id, "archived").success, false);
});

test("updateStatus() succeeds", () => {
  const store = new SupportTicketStore();
  const created = store.create("alice", "Help", "message");
  const id = created.success ? created.ticket.id : "";
  const result = store.updateStatus(id, "resolved");
  assert.equal(result.success, true);
  assert.equal(result.success && result.ticket.status, "resolved");
});

test("getAdminQueue() lists open/inProgress tickets before resolved ones", () => {
  const store = new SupportTicketStore();
  const resolved = store.create("alice", "Resolved issue", "message");
  const open = store.create("bob", "Open issue", "message");
  if (resolved.success) store.updateStatus(resolved.ticket.id, "resolved");

  const queue = store.getAdminQueue();
  assert.deepEqual(
    queue.map((t) => t.id),
    [open.success ? open.ticket.id : "", resolved.success ? resolved.ticket.id : ""]
  );
});

test("getAdminQueue() orders most recently updated first within each status group", () => {
  const store = new SupportTicketStore();
  const first = store.create("alice", "First", "message");
  const second = store.create("bob", "Second", "message");
  if (first.success) store.reply(first.ticket.id, "admin", "admin-1", "reply");

  const queue = store.getAdminQueue();
  assert.equal(queue[0].id, first.success ? first.ticket.id : "");
  assert.equal(queue[1].id, second.success ? second.ticket.id : "");
});
