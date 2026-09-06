"use client";

import { useEffect, useState } from "react";

// How often to proactively poll for a new service worker version. Browsers
// only check automatically on navigation, which a single-page chat session
// may not do for a long time.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export default function UpdateNotifier() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        // "installed" with an existing controller means this is an update to
        // an already-running app, not the very first install.
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(installing);
        }
      });
    };

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      registration = reg;
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
      }
      reg.addEventListener("updatefound", onUpdateFound);

      const interval = setInterval(() => reg.update().catch(() => {}), UPDATE_CHECK_INTERVAL_MS);
      return () => clearInterval(interval);
    });

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      registration?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <div className="chat-app__update-toast">
      <span>A new version of ChatApp is available.</span>
      <button
        className="chat-app__update-toast-button"
        onClick={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })}
      >
        Update now
      </button>
    </div>
  );
}
