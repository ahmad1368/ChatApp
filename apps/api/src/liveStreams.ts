export interface LiveStream {
  id: string;
  title: string;
  broadcaster: string;
  startedAt: string;
  // Badoo's real "Ability to share a private live stream with just one
  // Match" (#316) — when set, this stream is invite-only for that one
  // viewer: it's excluded from listActiveStreams()'s public discovery
  // list, and join() rejects anyone else.
  invitedViewer?: string;
}

export interface LiveStreamDetails extends LiveStream {
  viewers: string[];
}

export interface LiveStreamSummary extends LiveStream {
  viewerCount: number;
}

export interface LiveStreamComment {
  author: string;
  text: string;
  postedAt: string;
}

const MAX_COMMENTS_PER_STREAM = 200;
const MAX_COMMENT_LENGTH = 300;

export type StartStreamResult = { success: true; stream: LiveStream } | { success: false; error: string };
export type JoinStreamResult = { success: true; stream: LiveStreamDetails } | { success: false; error: string };
export type LeaveStreamResult = { success: true; ended: boolean } | { success: false; error: string };
export type EndStreamResult = { success: true } | { success: false; error: string };
export type PostCommentResult = { success: true; comment: LiveStreamComment } | { success: false; error: string };

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `live-stream-${Date.now()}-${idCounter}`;
}

/**
 * Badoo's real "Support for one-on-one or group live streams" (#274) —
 * the real, live-membership half of a broadcast: a broadcaster goes
 * live, viewers join/leave, and everyone sees a real live text-comment
 * feed, the same honest split #225's AudioRoomStore already established
 * for Clubhouse-style rooms: this app has no SFU (LiveKit or otherwise)
 * to actually mix one broadcaster's video out to many viewers at once.
 * What's genuinely real without one: a true one-on-one live stream is
 * exactly #128/#129's existing WebRTC video call between the
 * broadcaster and the single first viewer (peer-to-peer needs no SFU
 * for two parties) — a *group* stream's video fan-out to every
 * additional viewer is the disclosed gap, not fabricated.
 *
 * #316 extends this with real access control: an optional `invitedViewer`
 * on `start()` makes the stream private — excluded from
 * `listActiveStreams()`'s public list, and `join()` rejects anyone but
 * that one invited match. Video transport is unchanged (still the same
 * peer-to-peer WebRTC call with the first joiner); what's new here is who
 * is even allowed to discover and join.
 */
export class LiveStreamStore {
  private streamsById = new Map<string, LiveStream>();
  private viewersByStreamId = new Map<string, Set<string>>();
  private commentsByStreamId = new Map<string, LiveStreamComment[]>();

  start(broadcaster: unknown, title: unknown, invitedViewer?: unknown): StartStreamResult {
    const broadcasterName = typeof broadcaster === "string" ? broadcaster.trim() : "";
    if (!broadcasterName) return { success: false, error: "broadcaster is required" };

    const titleText = typeof title === "string" ? title.trim() : "";
    if (!titleText) return { success: false, error: "title is required" };

    for (const stream of this.streamsById.values()) {
      if (stream.broadcaster === broadcasterName) {
        return { success: false, error: "You're already live" };
      }
    }

    let invitedViewerName: string | undefined;
    if (invitedViewer !== undefined && invitedViewer !== null) {
      invitedViewerName = typeof invitedViewer === "string" ? invitedViewer.trim() : "";
      if (!invitedViewerName) return { success: false, error: "invitedViewer must be a non-empty string" };
      if (invitedViewerName === broadcasterName) return { success: false, error: "Cannot invite yourself" };
    }

    const stream: LiveStream = {
      id: generateId(),
      title: titleText,
      broadcaster: broadcasterName,
      startedAt: new Date().toISOString(),
      ...(invitedViewerName ? { invitedViewer: invitedViewerName } : {}),
    };
    this.streamsById.set(stream.id, stream);
    this.viewersByStreamId.set(stream.id, new Set());
    this.commentsByStreamId.set(stream.id, []);
    return { success: true, stream };
  }

  /** Public discovery list — #316's private streams (an invitedViewer set) never appear here. */
  listActiveStreams(): LiveStreamSummary[] {
    return [...this.streamsById.values()]
      .filter((stream) => !stream.invitedViewer)
      .map((stream) => ({ ...stream, viewerCount: this.viewersByStreamId.get(stream.id)?.size ?? 0 }))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  /** #316: the private streams a specific match has been personally invited to — how they find one, since it's excluded from listActiveStreams(). */
  listMyPrivateStreamInvites(viewer: string): LiveStreamSummary[] {
    return [...this.streamsById.values()]
      .filter((stream) => stream.invitedViewer === viewer)
      .map((stream) => ({ ...stream, viewerCount: this.viewersByStreamId.get(stream.id)?.size ?? 0 }))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  getStream(streamId: string): LiveStreamDetails | undefined {
    const stream = this.streamsById.get(streamId);
    if (!stream) return undefined;
    return { ...stream, viewers: [...(this.viewersByStreamId.get(streamId) ?? [])] };
  }

  /** The first viewer to join a stream is the one real WebRTC one-on-one call (via #128/#129's CallStore) can actually connect to. */
  isFirstViewer(streamId: string, viewer: string): boolean {
    const viewers = this.viewersByStreamId.get(streamId);
    if (!viewers) return false;
    return viewers.size === 0 || (viewers.size === 1 && viewers.has(viewer));
  }

  join(viewer: unknown, streamId: string): JoinStreamResult {
    const stream = this.streamsById.get(streamId);
    if (!stream) return { success: false, error: "Stream not found" };

    const viewerName = typeof viewer === "string" ? viewer.trim() : "";
    if (!viewerName) return { success: false, error: "viewer is required" };
    if (viewerName === stream.broadcaster) return { success: false, error: "You can't watch your own stream" };
    if (stream.invitedViewer && stream.invitedViewer !== viewerName) {
      return { success: false, error: "This is a private stream — only the invited Match can join" };
    }

    this.viewersByStreamId.get(streamId)!.add(viewerName);
    return { success: true, stream: this.getStream(streamId)! };
  }

  leave(viewer: unknown, streamId: string): LeaveStreamResult {
    const viewers = this.viewersByStreamId.get(streamId);
    if (!viewers) return { success: false, error: "Stream not found" };

    const viewerName = typeof viewer === "string" ? viewer.trim() : "";
    viewers.delete(viewerName);
    return { success: true, ended: false };
  }

  end(broadcaster: unknown, streamId: string): EndStreamResult {
    const stream = this.streamsById.get(streamId);
    if (!stream) return { success: false, error: "Stream not found" };

    const broadcasterName = typeof broadcaster === "string" ? broadcaster.trim() : "";
    if (stream.broadcaster !== broadcasterName) return { success: false, error: "Only the broadcaster can end this stream" };

    this.streamsById.delete(streamId);
    this.viewersByStreamId.delete(streamId);
    this.commentsByStreamId.delete(streamId);
    return { success: true };
  }

  postComment(author: unknown, streamId: string, text: unknown): PostCommentResult {
    const stream = this.streamsById.get(streamId);
    if (!stream) return { success: false, error: "Stream not found" };

    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };

    const isParticipant = authorName === stream.broadcaster || this.viewersByStreamId.get(streamId)?.has(authorName);
    if (!isParticipant) return { success: false, error: "Join this stream before commenting" };

    const commentText = typeof text === "string" ? text.trim().slice(0, MAX_COMMENT_LENGTH) : "";
    if (!commentText) return { success: false, error: "text is required" };

    const comment: LiveStreamComment = { author: authorName, text: commentText, postedAt: new Date().toISOString() };
    const comments = this.commentsByStreamId.get(streamId)!;
    comments.push(comment);
    if (comments.length > MAX_COMMENTS_PER_STREAM) comments.shift();
    return { success: true, comment };
  }

  getComments(streamId: string): LiveStreamComment[] {
    return this.commentsByStreamId.get(streamId) ?? [];
  }
}
