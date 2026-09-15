import { randomUUID } from "crypto";

export interface InterestGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
}

export interface InterestGroupSummary extends InterestGroup {
  memberCount: number;
}

export interface GroupActivity {
  id: string;
  groupId: string;
  host: string;
  title: string;
  description: string;
  startsAt: string;
  capacity: number;
}

export interface GroupActivityDetails extends GroupActivity {
  confirmedAttendees: string[];
  waitlist: string[];
  spotsRemaining: number;
}

export type CreateGroupResult = { success: true; group: InterestGroup } | { success: false; error: string };
export type JoinGroupResult = { success: true; memberCount: number } | { success: false; error: string };
export type LeaveGroupResult = { success: true; memberCount: number } | { success: false; error: string };
export type CreateActivityResult = { success: true; activity: GroupActivity } | { success: false; error: string };
export type RsvpResult = { success: true; status: "confirmed" | "waitlisted" } | { success: false; error: string };
export type CancelRsvpResult = { success: true } | { success: false; error: string };

/**
 * Match.com's real "Ability to form interest groups (e.g., a hiking
 * group)" (#228): a persistent, joinable circle of members around a
 * shared interest — distinct from #223's ForumStore (discussion threads
 * and replies, no group-organized real-world activity) and from
 * #221/#222's GroupEventStore (a one-off event anyone can host, with no
 * persistent membership before or after it). The real differentiator
 * here is that members of a group can spin up a real, capacity-limited
 * RSVP'd Activity (e.g. this Saturday's hike) restricted to that group's
 * own members — reusing the exact same waitlist/promotion mechanic
 * #221/#222/#227 already established, since that part genuinely doesn't
 * change, but scoped to a standing membership rather than open to anyone
 * or curated by an admin.
 */
export class InterestGroupStore {
  private groupsById = new Map<string, InterestGroup>();
  private membersByGroupId = new Map<string, Set<string>>();
  private activitiesById = new Map<string, GroupActivity>();
  private activityIdsByGroupId = new Map<string, string[]>();
  private confirmedByActivityId = new Map<string, string[]>();
  private waitlistByActivityId = new Map<string, string[]>();

  createGroup(creator: unknown, payload: { name?: unknown; description?: unknown } | undefined): CreateGroupResult {
    const creatorName = typeof creator === "string" ? creator.trim() : "";
    if (!creatorName) return { success: false, error: "creator is required" };

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) return { success: false, error: "name is required" };

    const description = typeof payload?.description === "string" ? payload.description.trim() : "";

    const group: InterestGroup = { id: randomUUID(), name, description, createdBy: creatorName, createdAt: new Date().toISOString() };
    this.groupsById.set(group.id, group);
    this.membersByGroupId.set(group.id, new Set([creatorName]));
    this.activityIdsByGroupId.set(group.id, []);
    return { success: true, group };
  }

  listGroups(): InterestGroupSummary[] {
    return [...this.groupsById.values()]
      .map((group) => ({ ...group, memberCount: this.membersByGroupId.get(group.id)?.size ?? 0 }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getGroup(groupId: string): (InterestGroupSummary & { members: string[] }) | undefined {
    const group = this.groupsById.get(groupId);
    if (!group) return undefined;
    const members = [...(this.membersByGroupId.get(groupId) ?? [])];
    return { ...group, members, memberCount: members.length };
  }

  isMember(groupId: string, user: unknown): boolean {
    const userName = typeof user === "string" ? user.trim() : "";
    return this.membersByGroupId.get(groupId)?.has(userName) ?? false;
  }

  join(member: unknown, groupId: string): JoinGroupResult {
    const members = this.membersByGroupId.get(groupId);
    if (!members) return { success: false, error: "Group not found" };

    const memberName = typeof member === "string" ? member.trim() : "";
    if (!memberName) return { success: false, error: "member is required" };

    members.add(memberName);
    return { success: true, memberCount: members.size };
  }

  leave(member: unknown, groupId: string): LeaveGroupResult {
    const members = this.membersByGroupId.get(groupId);
    if (!members) return { success: false, error: "Group not found" };

    const memberName = typeof member === "string" ? member.trim() : "";
    if (!members.has(memberName)) return { success: false, error: "You haven't joined this group" };

    members.delete(memberName);
    return { success: true, memberCount: members.size };
  }

  createActivity(
    host: unknown,
    groupId: string,
    payload: { title?: unknown; description?: unknown; startsAt?: unknown; capacity?: unknown } | undefined
  ): CreateActivityResult {
    if (!this.groupsById.has(groupId)) return { success: false, error: "Group not found" };

    const hostName = typeof host === "string" ? host.trim() : "";
    if (!hostName) return { success: false, error: "host is required" };
    if (!this.isMember(groupId, hostName)) return { success: false, error: "Join this group before organizing an activity" };

    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    if (!title) return { success: false, error: "title is required" };

    const startsAtRaw = typeof payload?.startsAt === "string" ? payload.startsAt : "";
    const startsAt = new Date(startsAtRaw);
    if (!startsAtRaw || Number.isNaN(startsAt.getTime())) return { success: false, error: "startsAt must be a valid date/time" };

    const capacity = payload?.capacity;
    if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1) {
      return { success: false, error: "capacity must be a positive integer" };
    }

    const description = typeof payload?.description === "string" ? payload.description.trim() : "";

    const activity: GroupActivity = {
      id: randomUUID(),
      groupId,
      host: hostName,
      title,
      description,
      startsAt: startsAt.toISOString(),
      capacity,
    };
    this.activitiesById.set(activity.id, activity);
    this.activityIdsByGroupId.get(groupId)!.push(activity.id);
    this.confirmedByActivityId.set(activity.id, []);
    this.waitlistByActivityId.set(activity.id, []);
    return { success: true, activity };
  }

  /** This group's upcoming activities, soonest first. */
  listActivities(groupId: string, now: number = Date.now()): GroupActivity[] {
    const activityIds = this.activityIdsByGroupId.get(groupId) ?? [];
    return activityIds
      .map((id) => this.activitiesById.get(id)!)
      .filter((activity) => new Date(activity.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  rsvp(author: unknown, activityId: string): RsvpResult {
    const activity = this.activitiesById.get(activityId);
    if (!activity) return { success: false, error: "Activity not found" };

    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (!this.isMember(activity.groupId, authorText)) return { success: false, error: "Join this group before RSVPing" };

    const confirmed = this.confirmedByActivityId.get(activityId)!;
    const waitlist = this.waitlistByActivityId.get(activityId)!;
    if (confirmed.includes(authorText) || waitlist.includes(authorText)) {
      return { success: false, error: "You've already RSVP'd to this activity" };
    }

    if (confirmed.length < activity.capacity) {
      confirmed.push(authorText);
      return { success: true, status: "confirmed" };
    }
    waitlist.push(authorText);
    return { success: true, status: "waitlisted" };
  }

  cancelRsvp(author: unknown, activityId: string): CancelRsvpResult {
    if (!this.activitiesById.has(activityId)) return { success: false, error: "Activity not found" };

    const authorText = typeof author === "string" ? author.trim() : "";
    const confirmed = this.confirmedByActivityId.get(activityId)!;
    const waitlist = this.waitlistByActivityId.get(activityId)!;

    const confirmedIndex = confirmed.indexOf(authorText);
    if (confirmedIndex !== -1) {
      confirmed.splice(confirmedIndex, 1);
      const promoted = waitlist.shift();
      if (promoted) confirmed.push(promoted);
      return { success: true };
    }

    const waitlistIndex = waitlist.indexOf(authorText);
    if (waitlistIndex !== -1) {
      waitlist.splice(waitlistIndex, 1);
      return { success: true };
    }
    return { success: false, error: "You haven't RSVP'd to this activity" };
  }

  getActivity(activityId: string): GroupActivityDetails | undefined {
    const activity = this.activitiesById.get(activityId);
    if (!activity) return undefined;
    const confirmedAttendees = this.confirmedByActivityId.get(activityId) ?? [];
    const waitlist = this.waitlistByActivityId.get(activityId) ?? [];
    return { ...activity, confirmedAttendees, waitlist, spotsRemaining: Math.max(0, activity.capacity - confirmedAttendees.length) };
  }
}
