"use client";

import { ChatLocationShare } from "@chatapp/shared";

/**
 * WhatsApp/Bumble's real "send live or text location" (#127) — no map
 * library is bundled (this app has no interactive-map dependency
 * anywhere), so a location renders as a plain link out to Google Maps,
 * same "honest, no fabricated infra" call as SOSAlertView.tsx's own
 * location link.
 */
export default function LocationMessage({
  location,
  liveUpdate,
}: {
  location: ChatLocationShare;
  liveUpdate?: { latitude: number; longitude: number };
}) {
  const latitude = liveUpdate?.latitude ?? location.latitude;
  const longitude = liveUpdate?.longitude ?? location.longitude;
  const hasEnded = location.live && location.expiresAt && new Date(location.expiresAt).getTime() <= Date.now();

  return (
    <div className="chat-app__location">
      {location.label && <div className="chat-app__location-label">{location.label}</div>}
      <a
        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
        target="_blank"
        rel="noreferrer"
        className="chat-app__location-link"
      >
        📍 {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </a>
      {location.live && (
        <div className="chat-app__location-live">{hasEnded ? "Live location sharing ended" : "🔴 Live location"}</div>
      )}
    </div>
  );
}
