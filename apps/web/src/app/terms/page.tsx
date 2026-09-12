"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../guestIdentity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Feeld's real "Direct links to terms, privacy policy and support"
 * (#169). This app has no account-creation gate to require explicit
 * consent at (guest chat identities, #21-28's phone auth is additive) —
 * so opening this page is what records acceptance of the current terms
 * version (see termsAcceptance.ts), the honest equivalent available here.
 */
export default function TermsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());

  useEffect(() => {
    fetch(`${API_URL}/api/terms-acceptance/${encodeURIComponent(author)}`, { method: "POST" }).catch(() => {});
  }, [author]);

  return (
    <main style={{ maxWidth: 640, margin: "48px auto", padding: 16, fontFamily: "sans-serif", lineHeight: 1.6 }}>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <h1>Terms of Service</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>Last updated: version 1</p>

      <h2>1. Who this is for</h2>
      <p>
        ChatApp is a real-time dating and chat product. You must be old enough in your jurisdiction to use a dating
        service, and you agree to represent yourself honestly in your profile, photos, and conversations.
      </p>

      <h2>2. Your account and identity</h2>
      <p>
        You can use ChatApp with a lightweight guest identity or sign in with a phone number, Google, Apple, or
        Facebook. You're responsible for keeping access to your identity secure and for anything sent from it.
      </p>

      <h2>3. Conduct</h2>
      <p>
        Harassment, scams, spam, impersonation, and sharing sexually explicit content of another person without
        consent are prohibited. We may remove content, suspend matching privileges, or block an account that
        violates this, using the safety tooling described in our Safety Center.
      </p>

      <h2>4. Content you send</h2>
      <p>
        You keep ownership of what you post. By sending a message, photo, or voice note, you grant ChatApp the
        license needed to store and deliver it to the people you're chatting with.
      </p>

      <h2>5. Location and media</h2>
      <p>
        Some features (live location sharing, camera/microphone access, crossed-paths detection) only work if you
        grant the relevant browser permission — see the App Permissions settings page for what's currently granted
        and why nothing here can revoke a permission on your behalf.
      </p>

      <h2>6. Changes</h2>
      <p>
        We may update these terms as the product changes. Continuing to use ChatApp after an update means you accept
        the current version, tracked the moment you open this page.
      </p>

      <p style={{ marginTop: 24 }}>
        Questions? Visit <Link href="/support">Support</Link> or read our <Link href="/privacy-policy">Privacy Policy</Link>.
      </p>
    </main>
  );
}
