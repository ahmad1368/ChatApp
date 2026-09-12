"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface TicketMessage {
  id: string;
  sender: "user" | "admin";
  senderName: string;
  text: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  author: string;
  subject: string;
  status: "open" | "inProgress" | "resolved";
  updatedAt: string;
  messages: TicketMessage[];
}

const STATUS_LABEL: Record<Ticket["status"], string> = { open: "Open", inProgress: "In progress", resolved: "Resolved" };

/**
 * Bumble's real "Live admin support for users via ticket or chat"
 * (#180) — the admin-facing side of the ticket thread (see
 * supportTickets.ts for why this is an async ticket queue, not a
 * live-staffed chat).
 */
export default function AdminSupportPage() {
  const [adminKey, setAdminKey] = useState("");
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/support-tickets`, { headers: { "x-admin-key": adminKey } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load tickets");
      return;
    }
    setTickets(body.tickets);
    if (selected) {
      const updated = body.tickets.find((t: Ticket) => t.id === selected.id);
      if (updated) setSelected(updated);
    }
  };

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/admin/support-tickets/${selected.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ senderName: "admin", text: replyText }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to send reply");
      return;
    }
    setReplyText("");
    setSelected(body.ticket);
    load();
  };

  const resolve = async () => {
    if (!selected) return;
    const res = await fetch(`${API_URL}/api/admin/support-tickets/${selected.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ status: "resolved" }),
    });
    if (res.ok) {
      setSelected((await res.json()).ticket);
      load();
    }
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Back to admin dashboard</Link>
      </p>
      <h1>Support tickets</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        style={{ display: "flex", gap: 8, marginTop: 16 }}
      >
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Admin key"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={!adminKey}>
          Load queue
        </button>
      </form>

      {error && <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{error}</p>}

      {!selected && tickets && tickets.length === 0 && (
        <p style={{ color: "var(--color-muted)", marginTop: 16 }}>No tickets.</p>
      )}

      {!selected && tickets && tickets.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {tickets.map((ticket) => (
            <li
              key={ticket.id}
              onClick={() => setSelected(ticket)}
              style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8, cursor: "pointer" }}
            >
              <strong>{ticket.subject}</strong> — {ticket.author} — {STATUS_LABEL[ticket.status]}
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setSelected(null)} style={{ marginBottom: 12 }}>
            &larr; All tickets
          </button>
          <h2 style={{ fontSize: 16 }}>
            {selected.subject} — {selected.author} — {STATUS_LABEL[selected.status]}
          </h2>
          {selected.messages.map((msg) => (
            <p key={msg.id} style={{ fontSize: 13 }}>
              <strong>{msg.sender === "admin" ? msg.senderName : selected.author}:</strong> {msg.text}
            </p>
          ))}
          {selected.status !== "resolved" && (
            <>
              <form onSubmit={reply} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply"
                  style={{ flex: 1, padding: 8 }}
                />
                <button type="submit" disabled={!replyText}>
                  Send
                </button>
              </form>
              <button onClick={resolve} style={{ marginTop: 8 }}>
                Mark resolved
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
