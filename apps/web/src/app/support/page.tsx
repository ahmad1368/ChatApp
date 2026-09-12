"use client";

import Link from "next/link";

/**
 * Feeld's real "Direct links to terms, privacy policy and support"
 * (#169). Points at the real self-serve tools this app already has
 * (Safety Center, blocking, account deletion, active sessions) rather
 * than inventing a new support-ticket backend this issue didn't ask for.
 */
export default function SupportPage() {
  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif", lineHeight: 1.6 }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Support</h1>

      <h2>Safety concerns</h2>
      <p>
        If you feel unsafe or want to review meeting-in-person guidance, start with the{" "}
        <Link href="/safety">Safety Center</Link>. You can report or block anyone directly from a conversation.
      </p>

      <h2>Common tasks</h2>
      <ul>
        <li>
          <Link href="/settings/sessions">See or log out of your active devices</Link>
        </li>
        <li>
          <Link href="/privacy/export">Download a copy of your data</Link>
        </li>
        <li>
          <Link href="/settings/profile">Snooze or hide your profile</Link> without deleting your account
        </li>
        <li>
          <Link href="/settings/permissions">Check location, camera, or microphone access</Link>
        </li>
      </ul>

      <h2>Contact us</h2>
      <p>
        For anything not covered above, email{" "}
        <a href="mailto:support@chatapp.example">support@chatapp.example</a>.
      </p>

      <p style={{ marginTop: 24 }}>
        See also our <Link href="/terms">Terms of Service</Link> and <Link href="/privacy-policy">Privacy Policy</Link>.
      </p>
    </main>
  );
}
