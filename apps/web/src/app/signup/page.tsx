"use client";

import { useRouter } from "next/navigation";
import GoogleSignInButton from "../GoogleSignInButton";
import { saveStoredAuth } from "../authClient";

export default function SignupPage() {
  const router = useRouter();

  return (
    <main style={{ maxWidth: 360, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Sign up</h1>
      <GoogleSignInButton
        onSignedIn={(auth) => {
          saveStoredAuth(auth as Parameters<typeof saveStoredAuth>[0]);
          router.push("/");
        }}
      />
    </main>
  );
}
