"use client";

import Link from "next/link";
import { SAFETY_TIPS } from "@chatapp/shared";

export default function SafetyCenter() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>🛡️ Safety Center</h1>
      <p style={{ color: "#666" }}>
        Meeting someone new is exciting — a little preparation keeps it safe. Here&apos;s how we
        recommend approaching it.
      </p>

      <h2 style={{ fontSize: 16 }}>Safety tips</h2>
      <ul>
        {SAFETY_TIPS.map((tip) => (
          <li key={tip} style={{ marginBottom: 4 }}>
            {tip}
          </li>
        ))}
      </ul>

      <section style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
        <h2 style={{ fontSize: 16 }}>Share your date</h2>
        <p style={{ color: "#666" }}>
          Let one or more trusted contacts know where you are, and push a live status update
          ("on the way", "arrived", "safe") as your date goes.
        </p>
        <Link
          href="/share-my-date"
          style={{ display: "inline-block", padding: "8px 14px", border: "1px solid #ccc", borderRadius: 6 }}
        >
          Share My Date &rarr;
        </Link>
      </section>
    </main>
  );
}
