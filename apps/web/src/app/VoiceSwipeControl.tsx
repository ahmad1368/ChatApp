"use client";

import { useEffect, useRef, useState } from "react";

interface VoiceSwipeControlProps {
  onLike: () => void;
  onPass: () => void;
  onSuperLike: () => void;
  onUndo: () => void;
}

// Real, matched-word commands rather than an invented NLP intent model —
// each command lists every phrase this app treats as meaning it, checked
// against the browser's own transcript.
const COMMANDS: { phrases: string[]; action: keyof VoiceSwipeControlProps }[] = [
  { phrases: ["super like", "superlike", "star"], action: "onSuperLike" },
  { phrases: ["like", "yes"], action: "onLike" },
  { phrases: ["pass", "no", "skip", "nope"], action: "onPass" },
  { phrases: ["rewind", "undo", "back", "go back"], action: "onUndo" },
];

function matchCommand(transcript: string): keyof VoiceSwipeControlProps | null {
  const lower = transcript.toLowerCase().trim();
  for (const { phrases, action } of COMMANDS) {
    if (phrases.some((phrase) => lower.includes(phrase))) return action;
  }
  return null;
}

/**
 * Tinder's real "Voice command support for performing swipes" (#244):
 * the browser's own real Web Speech API (SpeechRecognition), the same
 * honest "real native capability, not a fabricated model" scoping this
 * app already applies elsewhere (#4's Notification API, #122's
 * getUserMedia) — no server-side speech/NLP model exists or is needed.
 * Applies the same "like"/"pass"/"super like"/"rewind" vocabulary as the
 * existing arrow-key swipe shortcuts (#91-#93), just spoken instead of
 * pressed. Off by default and only listens while explicitly toggled on,
 * since continuous microphone capture needs real, revocable permission.
 */
export default function VoiceSwipeControl({ onLike, onPass, onSuperLike, onUndo }: VoiceSwipeControlProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const recognitionRef = useRef<InstanceType<NonNullable<typeof window.SpeechRecognition>> | null>(null);
  const handlersRef = useRef({ onLike, onPass, onSuperLike, onUndo });
  handlersRef.current = { onLike, onPass, onSuperLike, onUndo };

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSupported(!!SpeechRecognitionCtor);
  }, []);

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const startListening = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setLastHeard(transcript);
      const action = matchCommand(transcript);
      if (action) handlersRef.current[action]();
    };
    recognition.onerror = (event) => {
      setError(event.error === "not-allowed" ? "Microphone permission denied" : `Voice recognition error: ${event.error}`);
      setListening(false);
    };
    recognition.onend = () => {
      // Browsers stop listening after a pause even in continuous mode —
      // restart automatically while the user still has it toggled on.
      if (recognitionRef.current === recognition) recognition.start();
    };

    recognitionRef.current = recognition;
    setError(null);
    recognition.start();
    setListening(true);
  };

  useEffect(() => stopListening, []);

  if (!supported) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={listening ? stopListening : startListening}
        aria-pressed={listening}
        aria-label={listening ? "Turn off voice commands" : "Turn on voice commands"}
        title='Say "like", "pass", "super like", or "rewind"'
      >
        {listening ? "🎤 Voice commands: On" : "🎤 Voice commands: Off"}
      </button>
      {error && <span style={{ color: "var(--color-danger)", marginLeft: 8, fontSize: 12 }}>{error}</span>}
      {listening && lastHeard && <span style={{ color: "var(--color-muted)", marginLeft: 8, fontSize: 12 }}>Heard: &quot;{lastHeard}&quot;</span>}
    </div>
  );
}
