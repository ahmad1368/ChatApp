"use client";

import TwoFactorSetup from "../../TwoFactorSetup";
import BiometricLogin from "../../BiometricLogin";
import DuplicateAccountNotice from "../../DuplicateAccountNotice";

export default function SecuritySettingsPage() {
  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Security</h1>
      <DuplicateAccountNotice />
      <TwoFactorSetup />
      <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />
      <BiometricLogin />
    </main>
  );
}
