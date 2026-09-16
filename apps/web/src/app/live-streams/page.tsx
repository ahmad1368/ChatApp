"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const COMMENTS_POLL_MS = 5000;

interface LiveStreamSummary {
  id: string;
  title: string;
  broadcaster: string;
  startedAt: string;
  viewerCount: number;
}

interface LiveStreamDetails extends LiveStreamSummary {
  viewers: string[];
}

interface LiveStreamComment {
  author: string;
  text: string;
  postedAt: string;
}

/**
 * Badoo's real "Support for one-on-one or group live streams" (#274) —
 * see liveStreams.ts for the honest scoping. Real one-on-one video
 * already exists via #128/#129's in-chat call feature; this page is the
 * real membership/live-comments half a broadcast needs, not a
 * fabricated N-way video mixer this app has no SFU to run.
 */
export default function LiveStreamsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [streams, setStreams] = useState<LiveStreamSummary[]>([]);
  const [activeStream, setActiveStream] = useState<LiveStreamDetails | null>(null);
  const [isFirstViewer, setIsFirstViewer] = useState(false);
  const [comments, setComments] = useState<LiveStreamComment[]>([]);
  const [title, setTitle] = useState("");
  const [invitedViewer, setInvitedViewer] = useState("");
  const [privateInvites, setPrivateInvites] = useState<LiveStreamSummary[]>([]);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadStreams = () => {
    fetch(`${API_URL}/api/live-streams`)
      .then((res) => res.json())
      .then((body) => setStreams(body.streams ?? []))
      .catch(() => {});
    // Badoo's real "Ability to share a private live stream with just one
    // Match" (#316) — private streams don't show in the public list
    // above, so this is how the invited Match finds one.
    fetch(`${API_URL}/api/live-streams/invites/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setPrivateInvites(body.streams ?? []))
      .catch(() => {});
  };

  useEffect(loadStreams, [author]);

  const loadStream = (streamId: string) => {
    fetch(`${API_URL}/api/live-streams/${streamId}?viewer=${encodeURIComponent(author)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body) return;
        setActiveStream(body.stream);
        setIsFirstViewer(body.isFirstViewer);
      })
      .catch(() => {});
    fetch(`${API_URL}/api/live-streams/${streamId}/comments`)
      .then((res) => res.json())
      .then((body) => setComments(body.comments ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    if (!activeStream) return;
    const interval = setInterval(() => loadStream(activeStream.id), COMMENTS_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStream?.id]);

  const goLive = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/live-streams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ broadcaster: author, title, invitedViewer: invitedViewer.trim() || undefined }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to go live");
      return;
    }
    setTitle("");
    setInvitedViewer("");
    loadStreams();
    loadStream(body.stream.id);
  };

  const join = async (streamId: string) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/live-streams/${streamId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewer: author }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to join stream");
      return;
    }
    loadStream(streamId);
  };

  const leave = async () => {
    if (!activeStream) return;
    await fetch(`${API_URL}/api/live-streams/${activeStream.id}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewer: author }),
    });
    setActiveStream(null);
    setComments([]);
    loadStreams();
  };

  const endStream = async () => {
    if (!activeStream) return;
    await fetch(`${API_URL}/api/live-streams/${activeStream.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ broadcaster: author }),
    });
    setActiveStream(null);
    setComments([]);
    loadStreams();
  };

  const postComment = async () => {
    if (!activeStream || !commentText.trim()) return;
    const res = await fetch(`${API_URL}/api/live-streams/${activeStream.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, text: commentText }),
    });
    if (res.ok) {
      setCommentText("");
      loadStream(activeStream.id);
    }
  };

  const isBroadcaster = activeStream?.broadcaster === author;

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Live Streams</h1>
      <p>
        <Link href="/discover">&larr; Back to Discover</Link>
      </p>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        Real one-on-one video is available via an in-chat call. This page is the real broadcast
        membership and live-comments layer — with no video-mixing server available here, a stream
        with more than one viewer is a live text chat around the broadcaster, not a mixed video feed.
      </p>
      {!activeStream && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Stream title"
              style={{ flex: 1 }}
            />
            <button onClick={goLive} disabled={!title.trim()}>
              Go live
            </button>
          </div>
          <input
            type="text"
            value={invitedViewer}
            onChange={(e) => setInvitedViewer(e.target.value)}
            placeholder="Only for this Match (optional — leave blank for a public stream)"
            style={{ width: "100%", marginBottom: 12 }}
          />
          {privateInvites.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>🔒 Private streams shared with you</p>
              {privateInvites.map((stream) => (
                <div
                  key={stream.id}
                  style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 10, marginBottom: 8 }}
                >
                  <strong>{stream.title}</strong>
                  <p style={{ margin: "4px 0", fontSize: 13 }}>{stream.broadcaster}</p>
                  <button onClick={() => join(stream.id)}>Watch</button>
                </div>
              ))}
            </div>
          )}
          {streams.length === 0 && <p style={{ color: "var(--color-muted)" }}>No one is live right now.</p>}
          {streams.map((stream) => (
            <div
              key={stream.id}
              style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 10, marginBottom: 8 }}
            >
              <strong>{stream.title}</strong>
              <p style={{ margin: "4px 0", fontSize: 13 }}>
                {stream.broadcaster} · {stream.viewerCount} watching
              </p>
              <button onClick={() => join(stream.id)}>Watch</button>
            </div>
          ))}
        </>
      )}
      {activeStream && (
        <div>
          <h2>{activeStream.title}</h2>
          <p style={{ color: "var(--color-muted)" }}>
            {activeStream.broadcaster} · {activeStream.viewers.length} watching
            {isFirstViewer && !isBroadcaster && " · you're the only viewer — a real one-on-one video call is possible"}
          </p>
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: 8,
              height: 200,
              overflowY: "auto",
              marginBottom: 8,
            }}
          >
            {comments.map((comment, i) => (
              <p key={i} style={{ margin: "2px 0", fontSize: 13 }}>
                <strong>{comment.author}:</strong> {comment.text}
              </p>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Say something..."
              style={{ flex: 1 }}
            />
            <button onClick={postComment} disabled={!commentText.trim()}>
              Send
            </button>
          </div>
          <button onClick={isBroadcaster ? endStream : leave} style={{ marginTop: 8 }}>
            {isBroadcaster ? "End stream" : "Leave"}
          </button>
        </div>
      )}
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </main>
  );
}
