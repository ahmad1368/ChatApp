"use client";

import { useRouter } from "next/navigation";
import AppleSignInButton from "../AppleSignInButton";
import { saveStoredAuth } from "../authClient";

export default function SignupPage() {
  const router = useRouter();

  const handleSignedIn = (auth: unknown) => {
    saveStoredAuth(auth as Parameters<typeof saveStoredAuth>[0]);
    router.push("/");
  };

  return (
    <main style={{ maxWidth: 360, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Sign up</h1>
      <AppleSignInButton onSignedIn={handleSignedIn} />
    </main>
  );
}
