import { randomUUID } from "crypto";

const ALLOWED_MIME_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"]);
// Same 5MB cap as #64's VoiceIntroStore — plenty for a short chat voice note.
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
// A waveform is a downsampled amplitude sketch for rendering, not a
// lossless audio representation — this many points is already more visual
// detail than a small chat bubble can show.
const MAX_WAVEFORM_POINTS = 200;

interface StoredVoiceNote {
  mimeType: string;
  data: Buffer;
}

export type SaveVoiceNoteResult =
  | { success: true; id: string; waveform: number[] }
  | { success: false; error: string };

function isValidWaveform(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_WAVEFORM_POINTS &&
    value.every((point) => typeof point === "number" && Number.isFinite(point) && point >= 0 && point <= 1)
  );
}

/**
 * Badoo's real voice-note chat messages with a waveform (#122) — many
 * clips per room rather than #64's VoiceIntroStore's one-per-profile
 * shape, so its own store keyed by a generated id, same pattern as
 * uploads.ts for chat images. The waveform (an array of 0-1 amplitude
 * samples) is computed client-side from the recorded audio via the Web
 * Audio API — this server has no audio-decoding capability of its own —
 * and is only validated/bounded here, then carried on the chat message
 * itself (ChatMessage.waveform) so a recipient can render it without a
 * second fetch.
 */
export class VoiceNoteStore {
  private notes = new Map<string, StoredVoiceNote>();

  save(mimeType: unknown, base64Data: unknown, waveform: unknown): SaveVoiceNoteResult {
    const mime = typeof mimeType === "string" ? mimeType : "";
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return { success: false, error: "mimeType must be audio/webm, audio/mp4, audio/mpeg, or audio/ogg" };
    }
    if (!isValidWaveform(waveform)) {
      return { success: false, error: `waveform must be a non-empty list of at most ${MAX_WAVEFORM_POINTS} numbers between 0 and 1` };
    }

    const base64 = typeof base64Data === "string" ? base64Data : "";
    let data: Buffer;
    try {
      data = Buffer.from(base64, "base64");
    } catch {
      return { success: false, error: "data must be valid base64" };
    }
    if (data.length === 0) {
      return { success: false, error: "data must be valid base64" };
    }
    if (data.length > MAX_AUDIO_BYTES) {
      return { success: false, error: `Voice note exceeds the ${MAX_AUDIO_BYTES / (1024 * 1024)}MB size limit` };
    }

    const id = randomUUID();
    this.notes.set(id, { mimeType: mime, data });
    return { success: true, id, waveform };
  }

  get(id: string): StoredVoiceNote | undefined {
    return this.notes.get(id);
  }
}
