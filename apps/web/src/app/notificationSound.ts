export type RingtoneId = "default" | "chime" | "pop" | "silent";

interface Tone {
  frequency: number;
  startOffset: number;
  duration: number;
}

// Real, synthesized (Web Audio oscillator) tones — no bundled audio asset
// needed, and genuinely audible, unlike a fabricated "plays a sound" stub.
// The Push API itself has no cross-browser custom-sound option at all
// (see apps/api/src/notificationSound.ts's doc comment), so this only
// ever plays while the tab is open and foreground (see NotificationInbox.tsx).
const RINGTONES: Record<RingtoneId, Tone[]> = {
  default: [{ frequency: 880, startOffset: 0, duration: 0.15 }],
  chime: [
    { frequency: 660, startOffset: 0, duration: 0.12 },
    { frequency: 990, startOffset: 0.12, duration: 0.18 },
  ],
  pop: [{ frequency: 440, startOffset: 0, duration: 0.06 }],
  silent: [],
};

export function playRingtone(ringtone: RingtoneId): void {
  const tones = RINGTONES[ringtone];
  if (!tones || tones.length === 0) return;
  if (typeof window === "undefined") return;

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    for (const tone of tones) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(0.15, context.currentTime + tone.startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + tone.startOffset + tone.duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + tone.startOffset);
      oscillator.stop(context.currentTime + tone.startOffset + tone.duration);
    }
    setTimeout(() => context.close().catch(() => undefined), 1000);
  } catch {
    // Autoplay policies can reject an AudioContext started outside a user
    // gesture — silently skip rather than throwing into the poll loop.
  }
}

export function vibrateForeground(pattern: number[]): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

// Mirrors apps/api/src/notificationSound.ts's VIBRATION_PATTERNS for the
// foreground (tab-open) path — the server's copy is authoritative for
// background push, this one drives navigator.vibrate() when the client
// itself notices a new inbox entry (see NotificationInbox.tsx).
const CATEGORY_VIBRATION_PATTERNS: Record<string, number[]> = {
  newMatch: [200, 100, 200],
  newLike: [120],
  matchExpiryReminder: [100, 50, 100, 50, 100],
  liveEventStart: [300],
};

export function vibrationPatternForCategory(category: string): number[] {
  return CATEGORY_VIBRATION_PATTERNS[category] ?? [100];
}
