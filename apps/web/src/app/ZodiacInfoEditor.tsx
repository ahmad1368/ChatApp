"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ZODIAC_LABELS: Record<string, string> = {
  aries: "Aries",
  taurus: "Taurus",
  gemini: "Gemini",
  cancer: "Cancer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  scorpio: "Scorpio",
  sagittarius: "Sagittarius",
  capricorn: "Capricorn",
  aquarius: "Aquarius",
  pisces: "Pisces",
};

export default function ZodiacInfoEditor({ author }: { author: string }) {
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [zodiacSign, setZodiacSign] = useState<string | null>(null);
  const [hideZodiac, setHideZodiac] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/zodiac-info/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => {
        setBirthMonth(body.zodiacInfo?.birthMonth != null ? String(body.zodiacInfo.birthMonth) : "");
        setBirthDay(body.zodiacInfo?.birthDay != null ? String(body.zodiacInfo.birthDay) : "");
        setZodiacSign(body.zodiacInfo?.zodiacSign ?? null);
        setHideZodiac(body.zodiacInfo?.hideZodiac ?? false);
      })
      .catch(() => {});
  }, [author]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/zodiac-info/${encodeURIComponent(author)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birthMonth: birthMonth === "" ? null : Number(birthMonth),
          birthDay: birthDay === "" ? null : Number(birthDay),
          hideZodiac,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save zodiac info");
      }
      setZodiacSign(body.zodiacInfo?.zodiacSign ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save zodiac info");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12, fontSize: 13 }}>
      <h2 style={{ fontSize: 14 }}>Zodiac sign</h2>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input
          type="number"
          value={birthMonth}
          onChange={(e) => setBirthMonth(e.target.value)}
          placeholder="Birth month (1-12)"
          style={{ flex: 1 }}
        />
        <input
          type="number"
          value={birthDay}
          onChange={(e) => setBirthDay(e.target.value)}
          placeholder="Birth day"
          style={{ flex: 1 }}
        />
      </div>
      {zodiacSign && <p style={{ color: "var(--color-muted)" }}>Your sign: {ZODIAC_LABELS[zodiacSign]}</p>}
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input type="checkbox" checked={hideZodiac} onChange={(e) => setHideZodiac(e.target.checked)} />
        Hide zodiac sign on my profile
      </label>
      <button onClick={save} disabled={busy} style={{ marginTop: 8 }}>
        Save
      </button>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
    </section>
  );
}
