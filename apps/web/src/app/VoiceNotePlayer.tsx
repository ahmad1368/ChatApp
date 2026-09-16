"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "chatapp:voiceNotePlaybackRate";
const PLAYBACK_RATES = [1, 1.5, 2] as const;

function loadStoredRate(): number {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return (PLAYBACK_RATES as readonly number[]).includes(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

/**
 * Tinder's real "Send voice notes with adjustable playback speed (1x,
 * 1.5x, 2x)" (#256) — the browser's own real `HTMLMediaElement.
 * playbackRate`, the same "real native capability" scoping as #122's
 * MediaRecorder-based voice notes this wraps. The chosen speed is
 * remembered across every voice note in the app (localStorage), the same
 * "set it once" UX real chat apps use for this, rather than resetting to
 * 1x on every new message.
 */
export default function VoiceNotePlayer({ audioUrl, waveform }: { audioUrl: string; waveform?: number[] }) {
  const [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setRate(loadStoredRate());
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const cycleRate = () => {
    const currentIndex = PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number]);
    const next = PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
    setRate(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Storage unavailable — the choice just won't persist across notes.
    }
  };

  return (
    <div className="chat-app__voice-note">
      {waveform && waveform.length > 0 && (
        <div className="chat-app__waveform" aria-hidden>
          {waveform.map((peak, i) => (
            <div key={i} className="chat-app__waveform-bar" style={{ height: `${Math.max(10, peak * 100)}%` }} />
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <audio ref={audioRef} controls src={audioUrl} onPlay={() => { if (audioRef.current) audioRef.current.playbackRate = rate; }} />
        <button
          type="button"
          className="chat-app__theme-toggle"
          onClick={cycleRate}
          aria-label={`Playback speed: ${rate}x. Tap to change.`}
        >
          {rate}x
        </button>
      </div>
    </div>
  );
}
