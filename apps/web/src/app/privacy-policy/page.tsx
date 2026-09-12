"use client";

import Link from "next/link";

/**
 * Feeld's real "Direct links to terms, privacy policy and support"
 * (#169). Describes what this app actually stores and how a user
 * controls it, pointing at the real settings pages that back each claim
 * rather than generic boilerplate.
 */
export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif", lineHeight: 1.6 }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Privacy Policy</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>Last updated: version 1</p>

      <h2>What we store</h2>
      <p>
        Your profile fields (bio, photos, interests, and similar), the messages and media you send, your matches and
        swipe history, and account identifiers from whichever sign-in method you used (phone, Google, Apple, or
        Facebook).
      </p>

      <h2>Location</h2>
      <p>
        Location is only collected when you explicitly share it — a live or static pin in chat, or crossed-paths
        detection if you've opted in. See <Link href="/privacy/location">Location privacy</Link> for the exact
        controls, and <Link href="/settings/permissions">App permissions</Link> for what your browser has granted.
      </p>

      <h2>Who can see what</h2>
      <p>
        Messages are visible only to the people in that conversation. Profile fields you mark hidden aren't shown to
        other users. Online status and last-active time follow your own preference — see{" "}
        <Link href="/settings/presence-visibility">Online status settings</Link>.
      </p>

      <h2>Your controls</h2>
      <ul>
        <li>
          <Link href="/privacy/export">Download a copy of your data</Link>
        </li>
        <li>Delete your account, which removes your messages and profile data</li>
        <li>
          <Link href="/settings/clear-cache">Clear locally cached app files</Link> on this device
        </li>
      </ul>

      <h2>Safety</h2>
      <p>
        Reports, blocks, and the AI content warnings described in our Safety Center exist to keep the platform safe;
        see that page for how those signals are used.
      </p>

      <p style={{ marginTop: 24 }}>
        Questions about this policy? Visit <Link href="/support">Support</Link>.
      </p>
    </main>
  );
}
