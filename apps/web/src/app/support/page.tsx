"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

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
  subject: string;
  status: "open" | "inProgress" | "resolved";
  updatedAt: string;
  messages: TicketMessage[];
}

const STATUS_LABEL: Record<Ticket["status"], string> = { open: "Open", inProgress: "In progress", resolved: "Resolved" };

/**
 * Feeld's real "Direct links to terms, privacy policy and support"
 * (#169) — the self-serve links below are unchanged from that issue.
 * Bumble's real "Live admin support for users via ticket or chat"
 * (#180) replaces the old static "email us" contact method with a real,
 * working ticket thread — an asynchronous queue rather than a
 * live-staffed chat, since this app has no real support team on the
 * other end. See supportTickets.ts for that reasoning.
 */
export default function SupportPage() {
  const [author, setAuthor] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthor(getOrCreateGuestIdentity());
  }, []);

  useEffect(() => {
    if (author) loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  const loadTickets = async () => {
    const res = await fetch(`${API_URL}/api/support/tickets/${author}`);
    if (res.ok) setTickets((await res.json()).tickets);
  };

  const openTicket = async (id: string) => {
    const res = await fetch(`${API_URL}/api/support/tickets/${author}/${id}`);
    if (res.ok) setSelected((await res.json()).ticket);
  };

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/api/support/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, subject, message }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to open ticket");
      return;
    }
    setSubject("");
    setMessage("");
    loadTickets();
    setSelected(body.ticket);
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/support/tickets/${author}/${selected.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: replyText }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to send reply");
      return;
    }
    setReplyText("");
    setSelected(body.ticket);
    loadTickets();
  };

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif", lineHeight: 1.6 }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Support</h1>

      <h2>Safety concerns</h2>
      <p>
        If you feel unsafe or want to review meeting-in-person guidance, start with the{" "}
        <Link href="/safety">Safety Center</Link>. You can report or block anyone directly from a conversation.
      </p>

      <h2>Common tasks</h2>
      <ul>
        <li>
          <Link href="/settings/sessions">See or log out of your active devices</Link>
        </li>
        <li>
          <Link href="/privacy/export">Download a copy of your data</Link>
        </li>
        <li>
          <Link href="/settings/profile">Snooze or hide your profile</Link> without deleting your account
        </li>
        <li>
          <Link href="/settings/permissions">Check location, camera, or microphone access</Link>
        </li>
      </ul>

      <h2>Contact us</h2>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {!selected && (
        <>
          <form onSubmit={createTicket} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginTop: 16 }}>
            <h3 style={{ fontSize: 16, marginTop: 0 }}>New ticket</h3>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue"
              rows={3}
              style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
            />
            <button type="submit" disabled={!subject || !message} style={{ marginTop: 8 }}>
              Submit
            </button>
          </form>

          {tickets.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
              {tickets.map((ticket) => (
                <li
                  key={ticket.id}
                  onClick={() => openTicket(ticket.id)}
                  style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 8, cursor: "pointer" }}
                >
                  <strong>{ticket.subject}</strong> — {STATUS_LABEL[ticket.status]}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {selected && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setSelected(null)} style={{ marginBottom: 12 }}>
            &larr; All tickets
          </button>
          <h3 style={{ fontSize: 16 }}>
            {selected.subject} — {STATUS_LABEL[selected.status]}
          </h3>
          {selected.messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                textAlign: msg.sender === "admin" ? "left" : "right",
                margin: "8px 0",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  background: msg.sender === "admin" ? "var(--color-panel)" : "var(--chart-series-1)",
                  color: msg.sender === "admin" ? "var(--color-text)" : "#fff",
                  borderRadius: 8,
                  padding: "8px 12px",
                  maxWidth: "80%",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.8 }}>{msg.sender === "admin" ? msg.senderName : "You"}</div>
                <div>{msg.text}</div>
              </div>
            </div>
          ))}
          {selected.status !== "resolved" && (
            <form onSubmit={sendReply} style={{ display: "flex", gap: 8, marginTop: 12 }}>
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
          )}
        </div>
      )}

      <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 16 }}>
        Prefer email? Reach us at <a href="mailto:support@chatapp.example">support@chatapp.example</a>.
      </p>

      <p style={{ marginTop: 24 }}>
        See also our <Link href="/terms">Terms of Service</Link> and <Link href="/privacy-policy">Privacy Policy</Link>.
      </p>
    </main>
  );
}
