"use client";

import Link from "next/link";

/**
 * Feeld's real "Direct links to terms, privacy policy and support"
 * (#169) — the actual feature this issue asks for: one place with a
 * direct link to each.
 */
export default function LegalSettingsPage() {
  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Legal &amp; support</h1>
      <ul style={{ marginTop: 16, lineHeight: 2 }}>
        <li>
          <Link href="/terms">Terms of Service</Link>
        </li>
        <li>
          <Link href="/privacy-policy">Privacy Policy</Link>
        </li>
        <li>
          <Link href="/support">Support</Link>
        </li>
      </ul>
    </main>
  );
}
