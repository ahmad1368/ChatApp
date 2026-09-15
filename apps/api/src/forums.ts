import { randomUUID } from "crypto";

export interface ForumHub {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
}

export interface ForumHubSummary extends ForumHub {
  memberCount: number;
  threadCount: number;
}

export interface ForumThread {
  id: string;
  hubId: string;
  author: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface ForumThreadSummary extends ForumThread {
  replyCount: number;
  lastActivityAt: string;
}

export interface ForumReply {
  id: string;
  threadId: string;
  author: string;
  body: string;
  createdAt: string;
}

export type CreateHubResult = { success: true; hub: ForumHub } | { success: false; error: string };
export type JoinHubResult = { success: true; memberCount: number } | { success: false; error: string };
export type LeaveHubResult = { success: true; memberCount: number } | { success: false; error: string };
export type CreateThreadResult = { success: true; thread: ForumThread } | { success: false; error: string };
export type CreateReplyResult = { success: true; reply: ForumReply } | { success: false; error: string };

/**
 * Match.com's real "Discussion forums or topic-based communities" (#223):
 * topic-based Hubs (e.g. "Hiking", "Book Club") anyone can browse, but
 * that require joining before posting a thread or reply — the same
 * "lurk freely, join to participate" norm real forums use. Membership,
 * threads, and replies are each scoped to their own hub/thread rather
 * than a single flat feed, so a Hub reads as its own small community.
 */
export class ForumStore {
  private hubsById = new Map<string, ForumHub>();
  private membersByHubId = new Map<string, Set<string>>();
  private threadsById = new Map<string, ForumThread>();
  private threadIdsByHubId = new Map<string, string[]>();
  private repliesByThreadId = new Map<string, ForumReply[]>();

  createHub(creator: unknown, payload: { name?: unknown; description?: unknown } | undefined): CreateHubResult {
    const creatorName = typeof creator === "string" ? creator.trim() : "";
    if (!creatorName) return { success: false, error: "creator is required" };

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) return { success: false, error: "name is required" };

    const description = typeof payload?.description === "string" ? payload.description.trim() : "";

    const hub: ForumHub = {
      id: randomUUID(),
      name,
      description,
      createdBy: creatorName,
      createdAt: new Date().toISOString(),
    };
    this.hubsById.set(hub.id, hub);
    this.membersByHubId.set(hub.id, new Set([creatorName]));
    this.threadIdsByHubId.set(hub.id, []);
    return { success: true, hub };
  }

  listHubs(): ForumHubSummary[] {
    return [...this.hubsById.values()]
      .map((hub) => this.toHubSummary(hub))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getHub(hubId: string): ForumHubSummary | undefined {
    const hub = this.hubsById.get(hubId);
    return hub ? this.toHubSummary(hub) : undefined;
  }

  private toHubSummary(hub: ForumHub): ForumHubSummary {
    return {
      ...hub,
      memberCount: this.membersByHubId.get(hub.id)?.size ?? 0,
      threadCount: this.threadIdsByHubId.get(hub.id)?.length ?? 0,
    };
  }

  isMember(hubId: string, user: unknown): boolean {
    const userName = typeof user === "string" ? user.trim() : "";
    return this.membersByHubId.get(hubId)?.has(userName) ?? false;
  }

  joinHub(member: unknown, hubId: string): JoinHubResult {
    const members = this.membersByHubId.get(hubId);
    if (!members) return { success: false, error: "Hub not found" };

    const memberName = typeof member === "string" ? member.trim() : "";
    if (!memberName) return { success: false, error: "member is required" };

    members.add(memberName);
    return { success: true, memberCount: members.size };
  }

  leaveHub(member: unknown, hubId: string): LeaveHubResult {
    const members = this.membersByHubId.get(hubId);
    if (!members) return { success: false, error: "Hub not found" };

    const memberName = typeof member === "string" ? member.trim() : "";
    if (!members.has(memberName)) return { success: false, error: "You haven't joined this hub" };

    members.delete(memberName);
    return { success: true, memberCount: members.size };
  }

  createThread(
    author: unknown,
    hubId: string,
    payload: { title?: unknown; body?: unknown } | undefined
  ): CreateThreadResult {
    if (!this.hubsById.has(hubId)) return { success: false, error: "Hub not found" };

    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };
    if (!this.isMember(hubId, authorName)) return { success: false, error: "Join this hub before starting a thread" };

    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    if (!title) return { success: false, error: "title is required" };

    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!body) return { success: false, error: "body is required" };

    const thread: ForumThread = {
      id: randomUUID(),
      hubId,
      author: authorName,
      title,
      body,
      createdAt: new Date().toISOString(),
    };
    this.threadsById.set(thread.id, thread);
    this.threadIdsByHubId.get(hubId)!.push(thread.id);
    this.repliesByThreadId.set(thread.id, []);
    return { success: true, thread };
  }

  listThreads(hubId: string): ForumThreadSummary[] {
    const threadIds = this.threadIdsByHubId.get(hubId) ?? [];
    return threadIds
      .map((id) => this.threadsById.get(id)!)
      .map((thread) => this.toThreadSummary(thread))
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }

  private toThreadSummary(thread: ForumThread): ForumThreadSummary {
    const replies = this.repliesByThreadId.get(thread.id) ?? [];
    const lastActivityAt = replies.length ? replies[replies.length - 1].createdAt : thread.createdAt;
    return { ...thread, replyCount: replies.length, lastActivityAt };
  }

  getThread(threadId: string): { thread: ForumThreadSummary; replies: ForumReply[] } | undefined {
    const thread = this.threadsById.get(threadId);
    if (!thread) return undefined;
    return { thread: this.toThreadSummary(thread), replies: this.repliesByThreadId.get(threadId) ?? [] };
  }

  createReply(author: unknown, threadId: string, payload: { body?: unknown } | undefined): CreateReplyResult {
    const thread = this.threadsById.get(threadId);
    if (!thread) return { success: false, error: "Thread not found" };

    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };
    if (!this.isMember(thread.hubId, authorName)) return { success: false, error: "Join this hub before replying" };

    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!body) return { success: false, error: "body is required" };

    const reply: ForumReply = { id: randomUUID(), threadId, author: authorName, body, createdAt: new Date().toISOString() };
    this.repliesByThreadId.get(threadId)!.push(reply);
    return { success: true, reply };
  }
}
