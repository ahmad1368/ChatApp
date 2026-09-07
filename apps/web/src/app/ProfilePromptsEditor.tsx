"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_SELECTED_PROMPTS = 3;
const MAX_ANSWER_LENGTH = 150;

interface ProfilePrompt {
  id: string;
  text: string;
}

interface Slot {
  promptId: string;
  answer: string;
}

const EMPTY_SLOT: Slot = { promptId: "", answer: "" };

export default function ProfilePromptsEditor({ author }: { author: string }) {
  const [catalog, setCatalog] = useState<ProfilePrompt[]>([]);
  const [slots, setSlots] = useState<Slot[]>([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/profile-prompts/catalog`).then((res) => res.json()),
      fetch(`${API_URL}/api/profile-prompts/${encodeURIComponent(author)}`).then((res) => res.json()),
    ])
      .then(([catalogBody, answersBody]) => {
        setCatalog(catalogBody.prompts ?? []);
        const existing: Slot[] = (answersBody.answers ?? []).map(
          (a: { promptId: string; answer: string }) => ({ promptId: a.promptId, answer: a.answer })
        );
        const padded = [...existing];
        while (padded.length < MAX_SELECTED_PROMPTS) padded.push(EMPTY_SLOT);
        setSlots(padded);
      })
      .catch(() => {});
  }, [author]);

  const updateSlot = (index: number, patch: Partial<Slot>) => {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const answers = slots.filter((slot) => slot.promptId && slot.answer.trim());
      const res = await fetch(`${API_URL}/api/profile-prompts/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save prompts");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prompts");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Profile prompts</h2>
      <p style={{ color: "var(--color-muted)" }}>
        Pick up to {MAX_SELECTED_PROMPTS} prompts and answer them so people have something to reply to.
      </p>
      {slots.map((slot, i) => {
        const takenElsewhere = slots.some((other, j) => j !== i && other.promptId === slot.promptId);
        return (
          <div key={i} style={{ marginTop: 8 }}>
            <select
              value={slot.promptId}
              onChange={(e) => updateSlot(i, { promptId: e.target.value })}
              style={{ width: "100%" }}
            >
              <option value="">Choose a prompt…</option>
              {catalog.map((prompt) => (
                <option
                  key={prompt.id}
                  value={prompt.id}
                  disabled={prompt.id !== slot.promptId && slots.some((s) => s.promptId === prompt.id)}
                >
                  {prompt.text}
                </option>
              ))}
            </select>
            <textarea
              value={slot.answer}
              onChange={(e) => updateSlot(i, { answer: e.target.value.slice(0, MAX_ANSWER_LENGTH) })}
              placeholder="Your answer"
              rows={2}
              maxLength={MAX_ANSWER_LENGTH}
              disabled={!slot.promptId}
              style={{ width: "100%", resize: "vertical", marginTop: 4 }}
            />
            {takenElsewhere && (
              <p style={{ color: "var(--color-danger)" }}>Each prompt can only be selected once</p>
            )}
          </div>
        );
      })}
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save prompts
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
