"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type PermissionType = "location" | "camera" | "microphone";
type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

const PERMISSION_QUERY_NAME: Record<PermissionType, string> = {
  location: "geolocation",
  camera: "camera",
  microphone: "microphone",
};

const LABELS: Record<PermissionType, string> = {
  location: "Location",
  camera: "Camera",
  microphone: "Microphone",
};

/**
 * Tinder's real "Manage access permissions (location, camera, microphone
 * access)" (#166). `navigator.permissions.query()` genuinely reports the
 * browser's current grant for each of these three (Firefox/Safari don't
 * support querying camera/microphone this way — reported as "unsupported"
 * rather than faked); "Request access" actually triggers the real
 * getUserMedia/geolocation prompt. There's no JS API to *revoke* a
 * granted permission — only the browser's own site-settings UI can do
 * that, which this honestly says rather than shipping a fake "revoke"
 * button. Each observed status is mirrored to the server (see
 * permissionsStatus.ts) purely as a record, not the source of truth.
 */
export default function PermissionsSettings({ author }: { author: string }) {
  const [statuses, setStatuses] = useState<Record<PermissionType, PermissionState>>({
    location: "prompt",
    camera: "prompt",
    microphone: "prompt",
  });

  const report = (type: PermissionType, state: PermissionState) => {
    if (state === "unsupported") return;
    fetch(`${API_URL}/api/permissions-status/${encodeURIComponent(author)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, state }),
    }).catch(() => undefined);
  };

  useEffect(() => {
    let cancelled = false;
    (Object.keys(PERMISSION_QUERY_NAME) as PermissionType[]).forEach((type) => {
      if (!navigator.permissions?.query) {
        setStatuses((prev) => ({ ...prev, [type]: "unsupported" }));
        return;
      }
      navigator.permissions
        .query({ name: PERMISSION_QUERY_NAME[type] as PermissionName })
        .then((result) => {
          if (cancelled) return;
          setStatuses((prev) => ({ ...prev, [type]: result.state as PermissionState }));
          report(type, result.state as PermissionState);
          result.onchange = () => {
            setStatuses((prev) => ({ ...prev, [type]: result.state as PermissionState }));
            report(type, result.state as PermissionState);
          };
        })
        .catch(() => setStatuses((prev) => ({ ...prev, [type]: "unsupported" })));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  const requestAccess = async (type: PermissionType) => {
    try {
      if (type === "location") {
        await new Promise<void>((resolve, reject) => navigator.geolocation.getCurrentPosition(() => resolve(), reject));
        setStatuses((prev) => ({ ...prev, location: "granted" }));
        report("location", "granted");
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ [type === "camera" ? "video" : "audio"]: true });
        stream.getTracks().forEach((track) => track.stop());
        setStatuses((prev) => ({ ...prev, [type]: "granted" }));
        report(type, "granted");
      }
    } catch {
      setStatuses((prev) => ({ ...prev, [type]: "denied" }));
      report(type, "denied");
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>App permissions</h2>
      <p style={{ color: "var(--color-muted)" }}>
        To revoke access you've already granted, use your browser's site settings for this page — a website can't
        revoke its own permissions.
      </p>
      {(Object.keys(LABELS) as PermissionType[]).map((type) => (
        <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ minWidth: 90 }}>{LABELS[type]}:</span>
          <span>
            {statuses[type] === "granted" && "✅ Granted"}
            {statuses[type] === "denied" && "🚫 Denied"}
            {statuses[type] === "prompt" && "❔ Not yet asked"}
            {statuses[type] === "unsupported" && "Unknown (unsupported by this browser)"}
          </span>
          {statuses[type] === "prompt" && (
            <button onClick={() => requestAccess(type)} style={{ fontSize: 12 }}>
              Request access
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
