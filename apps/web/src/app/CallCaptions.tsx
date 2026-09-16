"use client";

import { useEffect, useRef, useState } from "react";

interface CallCaptionsProps {
  active: boolean;
  onTranscript: (text: string) => void;
  remoteCaption: string | null;
  remoteLabel: string;
}

/**
 * Tinder's real "Automatic captions for video calls" (#246): the browser's
 * own real Web Speech API (SpeechRecognition) running on each participant's
 * own microphone, the same honest "real native capability, not a fabricated
 * model" scoping as #244's VoiceSwipeControl — this component only turns
 * local speech into text and hands it off via onTranscript; ChatRoom.tsx
 * relays it to the other participant over call:caption. Off by default and
 * only listens while explicitly toggled on and the call is active, since
 * continuous microphone capture needs real, revocable permission.
 */
export default function CallCaptions({ active, onTranscript, remoteCaption, remoteLabel }: CallCaptionsProps) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [localCaption, setLocalCaption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<InstanceType<NonNullable<typeof window.SpeechRecognition>> | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSupported(!!SpeechRecognitionCtor);
  }, []);

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  };

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!enabled || !active || !SpeechRecognitionCtor) {
      stopListening();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setLocalCaption(transcript);
      onTranscriptRef.current(transcript);
    };
    recognition.onerror = (event) => {
      setError(event.error === "not-allowed" ? "Microphone permission denied for captions" : `Captions error: ${event.error}`);
    };
    recognition.onend = () => {
      // Browsers stop listening after a pause even in continuous mode —
      // restart automatically while captions are still toggled on.
      if (recognitionRef.current === recognition) recognition.start();
    };

    recognitionRef.current = recognition;
    setError(null);
    recognition.start();

    return stopListening;
  }, [enabled, active]);

  useEffect(() => {
    if (!active) setLocalCaption(null);
  }, [active]);

  if (!supported || !active) return null;

  return (
    <div className="chat-app__call-captions">
      <button
        type="button"
        onClick={() => setEnabled((prev) => !prev)}
        aria-pressed={enabled}
        aria-label={enabled ? "Turn off live captions" : "Turn on live captions"}
      >
        {enabled ? "💬 Captions: On" : "💬 Captions: Off"}
      </button>
      {error && <span style={{ color: "var(--color-danger)", marginLeft: 8, fontSize: 12 }}>{error}</span>}
      {enabled && (remoteCaption || localCaption) && (
        <div className="chat-app__call-caption-text" aria-live="polite">
          {remoteCaption && <p>{remoteLabel}: {remoteCaption}</p>}
          {localCaption && <p>You: {localCaption}</p>}
        </div>
      )}
    </div>
  );
}
