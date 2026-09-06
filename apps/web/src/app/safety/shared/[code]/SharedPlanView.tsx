"use client";

import { useEffect, useState } from "react";
import { SharedMeetupPlanView } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function SharedPlanView({ shareCode }: { shareCode: string }) {
  const [plan, setPlan] = useState<SharedMeetupPlanView | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/safety/plans/shared/${shareCode}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then(setPlan)
      .catch(() => setNotFound(true));
  }, [shareCode]);

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Date plan shared with you</h1>
      {notFound && <p>This link is invalid or has expired.</p>}
      {!notFound && !plan && <p>Loading…</p>}
      {plan && (
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
          <p>
            <strong>{plan.author}</strong> is meeting <strong>{plan.meetingWith}</strong>.
          </p>
          <p>
            <strong>Location:</strong> {plan.location}
          </p>
          <p>
            <strong>When:</strong> {new Date(plan.scheduledAt).toLocaleString()}
          </p>
        </div>
      )}
    </main>
  );
}
