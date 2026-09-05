"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BiometricLogin from "../../BiometricLogin";

// Demo entry point: real usage should derive the user id from an
// authenticated session (once #21-#25's auth lands) rather than a query
// param, which is exactly the security note in apps/api/src/server.ts.
function SecuritySettingsContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") ?? "demo-user";

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Security</h1>
      <BiometricLogin userId={userId} />
    </main>
  );
}

export default function SecuritySettingsPage() {
  return (
    <Suspense fallback={null}>
      <SecuritySettingsContent />
    </Suspense>
  );
}
