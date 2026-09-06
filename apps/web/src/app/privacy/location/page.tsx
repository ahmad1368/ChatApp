import { Suspense } from "react";
import LocationPrivacy from "./LocationPrivacy";

export default function LocationPrivacyPage() {
  return (
    <Suspense fallback={null}>
      <LocationPrivacy />
    </Suspense>
  );
}
