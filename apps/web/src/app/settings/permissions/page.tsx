"use client";

import { useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";
import PermissionsSettings from "../../PermissionsSettings";

/**
 * Tinder's real "Manage access permissions (location, camera, microphone
 * access)" (#166) — see PermissionsSettings.tsx for the actual browser
 * Permissions API integration.
 */
export default function PermissionsSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>App permissions</h1>
      <PermissionsSettings author={author} />
    </main>
  );
}
