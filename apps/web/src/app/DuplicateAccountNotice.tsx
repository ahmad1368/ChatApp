"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth, loadStoredAuth } from "./authClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Surfaces the #53 duplicate-account flag to the account it belongs to.
 * There's no moderator/review UI in this app yet, so the honest thing is to
 * tell the affected user directly rather than silently acting on a signal
 * that can be a false positive (shared wifi, a new phone, etc.).
 */
export default function DuplicateAccountNotice() {
  const [flagged, setFlagged] = useState(false);

  useEffect(() => {
    if (!loadStoredAuth()) return;
    fetchWithAuth(`${API_URL}/api/auth/duplicate-status`)
      .then((res) => (res.ok ? res.json() : undefined))
      .then((body) => setFlagged(Boolean(body?.flagged)))
      .catch(() => setFlagged(false));
  }, []);

  if (!flagged) return null;

  return (
    <p style={{ fontSize: 13, color: "#92400e", background: "#fef3c7", padding: 10, borderRadius: 6 }}>
      We noticed this account shares a network or device with another ChatApp account. If that&apos;s not you, no
      action is needed — this is just a heads-up, not a restriction.
    </p>
  );
}
