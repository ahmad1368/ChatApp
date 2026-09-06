/**
 * A best-effort device fingerprint for duplicate-account detection
 * (#53) — derived only from stable browser/device signals (never random,
 * never persisted), so the same device produces the same value across
 * sessions without needing storage. This is a heuristic signal, not an
 * identity proof: private browsing, browser updates, or a spoofed user
 * agent can all change it.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "";

  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    String(navigator.hardwareConcurrency ?? ""),
  ];

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("chatapp-fingerprint", 2, 2);
      parts.push(canvas.toDataURL());
    }
  } catch {
    // Canvas unavailable (e.g. some privacy modes) — fall back to the
    // signals already collected above.
  }

  return parts.join("|");
}
