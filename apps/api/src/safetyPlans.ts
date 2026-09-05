import { randomBytes } from "crypto";
import { MeetupPlan, SharedMeetupPlanView } from "@chatapp/shared";

export type CreatePlanResult = { success: true; plan: MeetupPlan } | { success: false; error: string };

/**
 * "Share your date" (Bumble/Tinder pattern): a user records who they're
 * meeting, where, and when, and gets a share code to send to a trusted
 * contact so someone else knows the plan. This is its own dependency-free
 * safety path, same as Report/Block. The share code alone grants read access
 * to the plan (like a Tinder share-my-date link) — there's no real
 * trusted-contact identity system yet to authenticate against.
 */
export class SafetyPlanStore {
  private plansById = new Map<string, MeetupPlan>();
  private plansByShareCode = new Map<string, MeetupPlan>();
  private nextId = 1;

  create(author: unknown, payload: Record<string, unknown> | undefined): CreatePlanResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const meetingWith = typeof payload?.meetingWith === "string" ? payload.meetingWith.trim() : "";
    const location = typeof payload?.location === "string" ? payload.location.trim() : "";
    const scheduledAtRaw = typeof payload?.scheduledAt === "string" ? payload.scheduledAt : "";

    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!meetingWith) {
      return { success: false, error: "meetingWith is required" };
    }
    if (!location) {
      return { success: false, error: "location is required" };
    }
    const scheduledAt = new Date(scheduledAtRaw);
    if (!scheduledAtRaw || Number.isNaN(scheduledAt.getTime())) {
      return { success: false, error: "scheduledAt must be a valid date/time" };
    }

    const plan: MeetupPlan = {
      id: String(this.nextId++),
      author: authorName,
      meetingWith,
      location,
      scheduledAt: scheduledAt.toISOString(),
      shareCode: randomBytes(4).toString("hex"),
      createdAt: new Date().toISOString(),
    };
    this.plansById.set(plan.id, plan);
    this.plansByShareCode.set(plan.shareCode, plan);
    return { success: true, plan };
  }

  getByShareCode(shareCode: string): SharedMeetupPlanView | undefined {
    const plan = this.plansByShareCode.get(shareCode);
    if (!plan) return undefined;
    const { author, meetingWith, location, scheduledAt, createdAt } = plan;
    return { author, meetingWith, location, scheduledAt, createdAt };
  }
}
