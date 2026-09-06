import { Suspense } from "react";
import PrivacySettings from "./PrivacySettings";

export default function PrivacyPage() {
  return (
    <Suspense fallback={null}>
      <PrivacySettings />
    </Suspense>
  );
}
