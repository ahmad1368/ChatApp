"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ForumHub {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  memberCount: number;
  threadCount: number;
}

interface ForumThread {
  id: string;
  hubId: string;
  author: string;
  title: string;
  body: string;
  createdAt: string;
  replyCount: number;
  lastActivityAt: string;
}

interface ForumReply {
  id: string;
  threadId: string;
  author: string;
  body: string;
  createdAt: string;
}

/**
 * Match.com's real "Discussion forums or topic-based communities" (#223)
 * — see forums.ts for the honest scoping (topic-based Hubs anyone can
 * browse, but joining is required before posting a thread or reply).
 */
export default function ForumsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [hubs, setHubs] = useState<ForumHub[]>([]);
  const [selectedHub, setSelectedHub] = useState<ForumHub | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [hubName, setHubName] = useState("");
  const [hubDescription, setHubDescription] = useState("");
  const [threadTitle, setThreadTitle] = useState("");
  const [threadBody, setThreadBody] = useState("");
  const [replyBody, setReplyBody] = useState("");

  const loadHubs = () => {
    fetch(`${API_URL}/api/forum-hubs`)
      .then((res) => res.json())
      .then((body) => setHubs(body.hubs ?? []))
      .catch(() => {});
  };

  useEffect(loadHubs, []);

  const openHub = (hub: ForumHub) => {
    setSelectedHub(hub);
    setSelectedThread(null);
    setError(null);
    fetch(`${API_URL}/api/forum-hubs/${hub.id}?member=${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setIsMember(!!body.isMember))
      .catch(() => {});
    fetch(`${API_URL}/api/forum-hubs/${hub.id}/threads`)
      .then((res) => res.json())
      .then((body) => setThreads(body.threads ?? []))
      .catch(() => {});
  };

  const openThread = (thread: ForumThread) => {
    setSelectedThread(thread);
    setError(null);
    fetch(`${API_URL}/api/forum-threads/${thread.id}`)
      .then((res) => res.json())
      .then((body) => setReplies(body.replies ?? []))
      .catch(() => {});
  };

  const createHub = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/forum-hubs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator: author, name: hubName, description: hubDescription }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to create hub");
      return;
    }
    setHubName("");
    setHubDescription("");
    loadHubs();
  };

  const toggleMembership = async () => {
    if (!selectedHub) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/forum-hubs/${selectedHub.id}/members`, {
      method: isMember ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member: author }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to update membership");
      return;
    }
    setIsMember(!isMember);
    setHubs((prev) => prev.map((h) => (h.id === selectedHub.id ? { ...h, memberCount: body.memberCount } : h)));
  };

  const createThread = async () => {
    if (!selectedHub) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/forum-hubs/${selectedHub.id}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, title: threadTitle, body: threadBody }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to create thread");
      return;
    }
    setThreadTitle("");
    setThreadBody("");
    openHub(selectedHub);
  };

  const createReply = async () => {
    if (!selectedThread) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/forum-threads/${selectedThread.id}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, body: replyBody }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to reply");
      return;
    }
    setReplyBody("");
    openThread(selectedThread);
  };

  return (
    <main style={{ maxWidth: 560, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Community Hubs</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {!selectedHub && (
        <>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Start a Hub</h3>
            <input
              value={hubName}
              onChange={(e) => setHubName(e.target.value)}
              placeholder="Topic (e.g. Hiking, Book Club)"
              style={{ width: "100%", marginBottom: 8 }}
            />
            <input
              value={hubDescription}
              onChange={(e) => setHubDescription(e.target.value)}
              placeholder="What's this hub about?"
              style={{ width: "100%", marginBottom: 8 }}
            />
            <button onClick={createHub} disabled={!hubName.trim()}>
              Create Hub
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {hubs.map((hub) => (
              <button
                key={hub.id}
                onClick={() => openHub(hub)}
                style={{ textAlign: "left", border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, cursor: "pointer" }}
              >
                <p style={{ fontWeight: 700, margin: 0 }}>{hub.name}</p>
                {hub.description && <p style={{ margin: "4px 0", fontSize: 13 }}>{hub.description}</p>}
                <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0 }}>
                  {hub.memberCount} member{hub.memberCount === 1 ? "" : "s"} &middot; {hub.threadCount} thread
                  {hub.threadCount === 1 ? "" : "s"}
                </p>
              </button>
            ))}
            {hubs.length === 0 && <p style={{ color: "var(--color-muted)" }}>No hubs yet — start the first one.</p>}
          </div>
        </>
      )}

      {selectedHub && !selectedThread && (
        <>
          <button onClick={() => setSelectedHub(null)} style={{ marginBottom: 12 }}>
            &larr; All Hubs
          </button>
          <h2 style={{ marginBottom: 0 }}>{selectedHub.name}</h2>
          {selectedHub.description && <p style={{ color: "var(--color-muted)", marginTop: 4 }}>{selectedHub.description}</p>}
          <button onClick={toggleMembership} style={{ marginBottom: 16 }}>
            {isMember ? "Leave Hub" : "Join Hub"}
          </button>

          {isMember && (
            <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>Start a thread</h3>
              <input
                value={threadTitle}
                onChange={(e) => setThreadTitle(e.target.value)}
                placeholder="Title"
                style={{ width: "100%", marginBottom: 8 }}
              />
              <textarea
                value={threadBody}
                onChange={(e) => setThreadBody(e.target.value)}
                placeholder="What do you want to discuss?"
                style={{ width: "100%", marginBottom: 8, minHeight: 60 }}
              />
              <button onClick={createThread} disabled={!threadTitle.trim() || !threadBody.trim()}>
                Post Thread
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => openThread(thread)}
                style={{ textAlign: "left", border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, cursor: "pointer" }}
              >
                <p style={{ fontWeight: 700, margin: 0 }}>{thread.title}</p>
                <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0" }}>
                  by {thread.author} &middot; {thread.replyCount} repl{thread.replyCount === 1 ? "y" : "ies"}
                </p>
              </button>
            ))}
            {threads.length === 0 && <p style={{ color: "var(--color-muted)" }}>No threads yet in this hub.</p>}
          </div>
        </>
      )}

      {selectedHub && selectedThread && (
        <>
          <button onClick={() => setSelectedThread(null)} style={{ marginBottom: 12 }}>
            &larr; {selectedHub.name}
          </button>
          <h2 style={{ marginBottom: 4 }}>{selectedThread.title}</h2>
          <p style={{ color: "var(--color-muted)", marginTop: 0 }}>by {selectedThread.author}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>{selectedThread.body}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0" }}>
            {replies.map((reply) => (
              <div key={reply.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{reply.author}</p>
                <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{reply.body}</p>
              </div>
            ))}
            {replies.length === 0 && <p style={{ color: "var(--color-muted)" }}>No replies yet.</p>}
          </div>

          {isMember ? (
            <div>
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply"
                style={{ width: "100%", marginBottom: 8, minHeight: 60 }}
              />
              <button onClick={createReply} disabled={!replyBody.trim()}>
                Reply
              </button>
            </div>
          ) : (
            <p style={{ color: "var(--color-muted)" }}>Join this hub to reply.</p>
          )}
        </>
      )}
    </main>
  );
}
