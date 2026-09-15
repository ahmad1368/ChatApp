"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface InterestGroupSummary {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  memberCount: number;
}

interface InterestGroupDetails extends InterestGroupSummary {
  members: string[];
}

interface GroupActivity {
  id: string;
  groupId: string;
  host: string;
  title: string;
  description: string;
  startsAt: string;
  capacity: number;
}

/**
 * Match.com's real "Ability to form interest groups (e.g., a hiking
 * group)" (#228) — see interestGroups.ts for the honest scoping (a
 * persistent, joinable membership circle that can organize its own
 * members-only RSVP'd activities, distinct from #223's discussion-only
 * Community Hubs).
 */
export default function InterestGroupsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());
  const [groups, setGroups] = useState<InterestGroupSummary[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<InterestGroupDetails | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [activities, setActivities] = useState<GroupActivity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityStartsAt, setActivityStartsAt] = useState("");
  const [activityCapacity, setActivityCapacity] = useState(10);
  const [rsvpStatusByActivity, setRsvpStatusByActivity] = useState<Record<string, string>>({});

  const loadGroups = () => {
    fetch(`${API_URL}/api/interest-groups`)
      .then((res) => res.json())
      .then((body) => setGroups(body.groups ?? []))
      .catch(() => {});
  };

  useEffect(loadGroups, []);

  const openGroup = (groupId: string) => {
    setError(null);
    fetch(`${API_URL}/api/interest-groups/${groupId}?member=${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setSelectedGroup(body.group ?? null);
        setIsMember(!!body.isMember);
      })
      .catch(() => {});
    fetch(`${API_URL}/api/interest-groups/${groupId}/activities`)
      .then((res) => res.json())
      .then((body) => setActivities(body.activities ?? []))
      .catch(() => {});
  };

  const createGroup = async () => {
    setError(null);
    const res = await fetch(`${API_URL}/api/interest-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator: author, name, description }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to create group");
      return;
    }
    setName("");
    setDescription("");
    loadGroups();
  };

  const toggleMembership = async () => {
    if (!selectedGroup) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/interest-groups/${selectedGroup.id}/members`, {
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
    setSelectedGroup((g) => (g ? { ...g, memberCount: body.memberCount } : g));
  };

  const createActivity = async () => {
    if (!selectedGroup) return;
    setError(null);
    const res = await fetch(`${API_URL}/api/interest-groups/${selectedGroup.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: author,
        title: activityTitle,
        startsAt: activityStartsAt ? new Date(activityStartsAt).toISOString() : "",
        capacity: activityCapacity,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to create activity");
      return;
    }
    setActivityTitle("");
    setActivityStartsAt("");
    openGroup(selectedGroup.id);
  };

  const rsvp = async (activityId: string) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/interest-group-activities/${activityId}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to RSVP");
      return;
    }
    setRsvpStatusByActivity((prev) => ({ ...prev, [activityId]: body.status }));
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Interest Groups</h1>

      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}

      {!selectedGroup && (
        <>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Form a group</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Interest (e.g. Hiking)"
              style={{ width: "100%", marginBottom: 8 }}
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group about?"
              style={{ width: "100%", marginBottom: 8 }}
            />
            <button onClick={createGroup} disabled={!name.trim()}>
              Create Group
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => openGroup(group.id)}
                style={{ textAlign: "left", border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, cursor: "pointer" }}
              >
                <p style={{ fontWeight: 700, margin: 0 }}>{group.name}</p>
                {group.description && <p style={{ margin: "4px 0", fontSize: 13 }}>{group.description}</p>}
                <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0 }}>
                  {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                </p>
              </button>
            ))}
            {groups.length === 0 && <p style={{ color: "var(--color-muted)" }}>No groups yet — form the first one.</p>}
          </div>
        </>
      )}

      {selectedGroup && (
        <>
          <button onClick={() => setSelectedGroup(null)} style={{ marginBottom: 12 }}>
            &larr; All Groups
          </button>
          <h2 style={{ marginBottom: 0 }}>{selectedGroup.name}</h2>
          {selectedGroup.description && <p style={{ color: "var(--color-muted)", marginTop: 4 }}>{selectedGroup.description}</p>}
          <p style={{ fontSize: 13 }}>{selectedGroup.members.join(", ")}</p>
          <button onClick={toggleMembership} style={{ marginBottom: 16 }}>
            {isMember ? "Leave Group" : "Join Group"}
          </button>

          {isMember && (
            <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>Organize an activity</h3>
              <input
                value={activityTitle}
                onChange={(e) => setActivityTitle(e.target.value)}
                placeholder="Title (e.g. Saturday hike)"
                style={{ width: "100%", marginBottom: 8 }}
              />
              <input
                type="datetime-local"
                value={activityStartsAt}
                onChange={(e) => setActivityStartsAt(e.target.value)}
                style={{ width: "100%", marginBottom: 8 }}
              />
              <input
                type="number"
                min={1}
                value={activityCapacity}
                onChange={(e) => setActivityCapacity(Number(e.target.value))}
                placeholder="Capacity"
                style={{ width: "100%", marginBottom: 8 }}
              />
              <button onClick={createActivity} disabled={!activityTitle.trim() || !activityStartsAt}>
                Organize
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activities.map((activity) => (
              <div key={activity.id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12 }}>
                <p style={{ fontWeight: 700, margin: 0 }}>{activity.title}</p>
                <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "4px 0" }}>
                  {new Date(activity.startsAt).toLocaleString()} &middot; organized by {activity.host}
                </p>
                {isMember && (
                  <button onClick={() => rsvp(activity.id)} disabled={!!rsvpStatusByActivity[activity.id]}>
                    {rsvpStatusByActivity[activity.id] === "confirmed"
                      ? "You're going!"
                      : rsvpStatusByActivity[activity.id] === "waitlisted"
                        ? "Waitlisted"
                        : "RSVP"}
                  </button>
                )}
              </div>
            ))}
            {activities.length === 0 && <p style={{ color: "var(--color-muted)" }}>No upcoming activities in this group yet.</p>}
          </div>
        </>
      )}
    </main>
  );
}
