"use client";

import { useState } from "react";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

/**
 * Tinder's real "System to create a two-person poll in chat" (#327): a
 * custom question and 2-4 options the creator writes on the spot — see
 * server.ts's message:send/chatPoll.ts for the authoritative validation
 * this only mirrors for the UI.
 */
export default function PollComposer({
  onSend,
  onClose,
}: {
  onSend: (question: string, options: string[]) => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, ""]);
  };

  const removeOption = (index: number) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const send = () => {
    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!trimmedQuestion) {
      setError("Add a question for the poll");
      return;
    }
    if (trimmedOptions.length < MIN_OPTIONS) {
      setError(`Add at least ${MIN_OPTIONS} options`);
      return;
    }
    setError(null);
    onSend(trimmedQuestion, trimmedOptions);
  };

  return (
    <div className="chat-app__date-invite-picker">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Poll question (e.g. Cinema or dinner?)"
        className="chat-app__input"
      />
      {options.map((option, i) => (
        <div key={i} style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            value={option}
            onChange={(e) => updateOption(i, e.target.value)}
            placeholder={`Option ${i + 1}`}
            className="chat-app__input"
          />
          {options.length > MIN_OPTIONS && (
            <button onClick={() => removeOption(i)} aria-label={`Remove option ${i + 1}`}>
              ✕
            </button>
          )}
        </div>
      ))}
      {options.length < MAX_OPTIONS && <button onClick={addOption}>+ Add option</button>}
      <div className="chat-app__date-invite-picker-actions">
        <button onClick={send}>📊 Send poll</button>
        <button className="chat-app__icon-close-button" onClick={onClose} aria-label="Close poll composer">
          ✕
        </button>
      </div>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
