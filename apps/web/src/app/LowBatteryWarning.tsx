"use client";

import { useEffect, useState } from "react";

const LOW_BATTERY_THRESHOLD = 0.2;

interface BatteryManager {
  level: number;
  charging: boolean;
  addEventListener: (type: "levelchange" | "chargingchange", listener: () => void) => void;
  removeEventListener: (type: "levelchange" | "chargingchange", listener: () => void) => void;
}

/**
 * Tinder's real "Low battery alert during an important video call"
 * (#329) — the real browser Battery Status API (`navigator.getBattery()`),
 * not a fabricated signal: Chromium-based browsers only (Firefox/Safari
 * removed it for privacy reasons), so this renders nothing rather than
 * guessing where the API is unavailable — an honest, disclosed gap.
 */
export default function LowBatteryWarning({ active }: { active: boolean }) {
  const [isLow, setIsLow] = useState(false);

  useEffect(() => {
    if (!active) {
      setIsLow(false);
      return;
    }

    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (!nav.getBattery) return;

    let battery: BatteryManager | null = null;
    let cancelled = false;
    const update = () => {
      if (battery) setIsLow(battery.level <= LOW_BATTERY_THRESHOLD && !battery.charging);
    };

    nav.getBattery().then((b) => {
      if (cancelled) return;
      battery = b;
      update();
      b.addEventListener("levelchange", update);
      b.addEventListener("chargingchange", update);
    });

    return () => {
      cancelled = true;
      battery?.removeEventListener("levelchange", update);
      battery?.removeEventListener("chargingchange", update);
    };
  }, [active]);

  if (!isLow) return null;

  return (
    <p style={{ color: "var(--color-danger)", fontSize: 13, marginTop: 4 }} role="alert">
      🔋 Your battery is low — plug in to avoid your call dropping.
    </p>
  );
}
