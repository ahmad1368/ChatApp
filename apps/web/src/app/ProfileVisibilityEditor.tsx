"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ProfileVisibilityEditor({ author }: { author: string }) {
  const [hideAge, setHideAge] = useState(false);
  const [hideDistance, setHideDistance] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/profile-visibility/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setHideAge(body.visibility?.hideAge ?? false);
        setHideDistance(body.visibility?.hideDistance ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async (next: { hideAge: boolean; hideDistance: boolean }) => {
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/profile-visibility/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Hide profile sections</h2>
      <p style={{ color: "var(--color-muted)" }}>Choose which core details show on your profile.</p>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input
          type="checkbox"
          checked={hideAge}
          disabled={busy}
          onChange={(e) => {
            setHideAge(e.target.checked);
            save({ hideAge: e.target.checked, hideDistance });
          }}
        />
        Hide my age
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input
          type="checkbox"
          checked={hideDistance}
          disabled={busy}
          onChange={(e) => {
            setHideDistance(e.target.checked);
            save({ hideAge, hideDistance: e.target.checked });
          }}
        />
        Hide my distance
      </label>
    </section>
  );
}
