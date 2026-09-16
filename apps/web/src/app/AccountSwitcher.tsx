"use client";

import { useState } from "react";
import { getSavedIdentities, addAndSwitchToNewIdentity, switchToIdentity } from "./guestIdentity";

/**
 * Tinder's real "Ability to add a second account and switch quickly"
 * (#291) — see guestIdentity.ts for why switching reloads the page.
 */
export default function AccountSwitcher({ author }: { author: string }) {
  const [open, setOpen] = useState(false);
  const [identities] = useState<string[]>(() => getSavedIdentities());

  const addAccount = () => {
    addAndSwitchToNewIdentity();
    window.location.reload();
  };

  const switchAccount = (identity: string) => {
    if (identity === author) return;
    switchToIdentity(identity);
    window.location.reload();
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen((prev) => !prev)} style={{ fontSize: 12 }}>
        👤 {author} ▾
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 10,
            background: "var(--color-bg, #fff)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: 8,
            minWidth: 180,
            marginTop: 4,
          }}
        >
          {identities.map((identity) => (
            <button
              key={identity}
              type="button"
              onClick={() => switchAccount(identity)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "4px 6px",
                fontSize: 13,
                fontWeight: identity === author ? "bold" : "normal",
                background: "none",
                border: "none",
              }}
            >
              {identity === author ? "✓ " : ""}
              {identity}
            </button>
          ))}
          <button
            type="button"
            onClick={addAccount}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "4px 6px", fontSize: 13, marginTop: 4, borderTop: "1px solid var(--color-border)" }}
          >
            + Add another account
          </button>
        </div>
      )}
    </div>
  );
}
