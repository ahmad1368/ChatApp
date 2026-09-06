"use client";

import TwoFactorSetup from "../../TwoFactorSetup";

export default function SecuritySettingsPage() {
  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Security</h1>
      <TwoFactorSetup />
    </main>
  );
}
