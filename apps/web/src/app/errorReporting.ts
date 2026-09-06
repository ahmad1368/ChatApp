const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const body = JSON.stringify({
    message,
    stack,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    ...extra,
  });

  // Best-effort: a failed error report shouldn't itself throw or retry loop.
  fetch(`${API_URL}/api/error-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function installGlobalErrorReporting(): () => void {
  const handleError = (event: ErrorEvent) => {
    reportError(event.error ?? event.message);
  };
  const handleRejection = (event: PromiseRejectionEvent) => {
    reportError(event.reason);
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}
