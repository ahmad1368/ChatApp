export const LARGE_UPLOAD_WARNING_BYTES = 5 * 1024 * 1024;

export interface ConnectionInfo {
  cellular: boolean;
  saveData: boolean;
}

/**
 * Tinder's real "Alert for large video upload volume on mobile data"
 * (#310) — uses the real (Chrome/Android-only; not in Safari/Firefox,
 * a disclosed gap rather than a fabricated cross-browser guarantee)
 * Network Information API to detect a cellular connection or the
 * user's own Data Saver preference, and warns before a large video
 * upload rather than silently spending their mobile data. Frontend-
 * only, no backend component — same precedent as #3/#8/#15/#241-
 * 243/#291/#296/#303, since network type is only observable client-side.
 */
export function getConnectionInfo(): ConnectionInfo | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { connection?: { type?: string; effectiveType?: string; saveData?: boolean } };
  const connection = nav.connection;
  if (!connection) return null;
  return {
    cellular: connection.type === "cellular",
    saveData: connection.saveData === true,
  };
}

export function shouldWarnBeforeUpload(fileSizeBytes: number, connection: ConnectionInfo | null): boolean {
  if (fileSizeBytes < LARGE_UPLOAD_WARNING_BYTES) return false;
  if (!connection) return false;
  return connection.cellular || connection.saveData;
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
