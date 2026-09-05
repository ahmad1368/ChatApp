const STORAGE_KEY = "chatapp:dataSaver";

interface NetworkInformationLike {
  saveData?: boolean;
}

function osSuggestsDataSaver(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  return Boolean(connection?.saveData);
}

/** Explicit user preference, if they've ever touched the toggle; otherwise
 * falls back to the OS/browser's own Data Saver signal. */
export function loadDataSaverPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "on") return true;
    if (stored === "off") return false;
  } catch {
    // Storage unavailable — fall through to the OS signal.
  }
  return osSuggestsDataSaver();
}

export function saveDataSaverPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Storage unavailable — preference just won't persist across reloads.
  }
}
